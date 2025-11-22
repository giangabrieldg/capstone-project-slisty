// scripts/authService.js - ROBUST VERSION with Multiple Fallbacks
class AuthService {
  constructor() {
    this.isChecking = false;
    this.authListeners = [];
    this.heartbeatInterval = null;
    this.BASE_URL =
      window.location.hostname === "localhost"
        ? "http://localhost:3000"
        : "https://capstone-project-slisty.onrender.com";

    // KEEP browserId in localStorage (persistent across sessions)
    this.browserId = this.getOrCreateBrowserId();

    // Track tab/window ID in sessionStorage (cleared on browser close)
    this.tabId = this.getOrCreateTabId();

    // Setup all cleanup mechanisms
    this.setupUnloadHandler();
    this.setupHeartbeat();
    this.checkStaleSession();
  }

  // Generate unique browser ID stored in localStorage (PERSISTENT)
  getOrCreateBrowserId() {
    let browserId = localStorage.getItem("browserId");
    if (!browserId) {
      browserId =
        "browser_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("browserId", browserId);
    }
    return browserId;
  }

  // Generate tab ID in sessionStorage (CLEARED on browser close)
  getOrCreateTabId() {
    let tabId = sessionStorage.getItem("tabId");
    if (!tabId) {
      tabId =
        "tab_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem("tabId", tabId);
    }
    return tabId;
  }

  // LAYER 1: beforeunload - Immediate cleanup when possible
  setupUnloadHandler() {
    let isNavigating = false;

    // Track internal navigation
    document.addEventListener("click", (e) => {
      const link = e.target.closest("a");
      if (link && link.href && link.href.startsWith(window.location.origin)) {
        isNavigating = true;
        setTimeout(() => {
          isNavigating = false;
        }, 100);
      }
    });

    // Try to logout on close/refresh
    window.addEventListener("beforeunload", (e) => {
      if (!isNavigating) {
        const token = sessionStorage.getItem("token");
        if (token) {
          // Mark this tab as closing
          sessionStorage.setItem("tab_closing", "true");

          // Use sendBeacon for reliable logout
          try {
            const payload = JSON.stringify({
              tabId: this.tabId,
              reason: "beforeunload",
            });
            navigator.sendBeacon(
              `${this.BASE_URL}/api/auth/logout`,
              new Blob([payload], { type: "application/json" })
            );
          } catch (error) {
            console.error("Beacon failed:", error);
          }
        }
      }
    });

    // Page visibility API (more reliable on mobile)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && !isNavigating) {
        const token = sessionStorage.getItem("token");
        if (token) {
          try {
            const payload = JSON.stringify({
              tabId: this.tabId,
              reason: "visibility_hidden",
            });
            navigator.sendBeacon(
              `${this.BASE_URL}/api/auth/logout`,
              new Blob([payload], { type: "application/json" })
            );
          } catch (error) {
            console.error("Visibility beacon failed:", error);
          }
        }
      } else if (document.visibilityState === "visible") {
        // Tab became visible again - verify session is still valid
        this.checkAuth();
      }
    });

    // Page Hide API (modern replacement for beforeunload)
    window.addEventListener("pagehide", (e) => {
      if (!isNavigating) {
        const token = sessionStorage.getItem("token");
        if (token) {
          try {
            const payload = JSON.stringify({
              tabId: this.tabId,
              reason: "pagehide",
            });
            navigator.sendBeacon(
              `${this.BASE_URL}/api/auth/logout`,
              new Blob([payload], { type: "application/json" })
            );
          } catch (error) {
            console.error("Pagehide beacon failed:", error);
          }
        }
      }
    });
  }

  // LAYER 2: Heartbeat - Keep session alive and detect dead tabs
  setupHeartbeat() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    // Send heartbeat every 2 minutes
    this.heartbeatInterval = setInterval(async () => {
      const currentToken = sessionStorage.getItem("token");
      if (!currentToken) {
        this.stopHeartbeat();
        return;
      }

      try {
        const response = await fetch(`${this.BASE_URL}/api/auth/heartbeat`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tabId: this.tabId,
            browserId: this.browserId,
          }),
          credentials: "include",
        });

        if (!response.ok) {
          // Session invalid - logout
          console.log("Heartbeat failed - session invalid");
          this.clearAuthData();
          this.notifyListeners(false, null);
          this.stopHeartbeat();
          window.location.href = "/login.html";
        }
      } catch (error) {
        console.error("Heartbeat error:", error);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    // Stop heartbeat when page visibility changes to hidden
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.stopHeartbeat();
      } else if (document.visibilityState === "visible") {
        this.setupHeartbeat();
      }
    });
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // LAYER 3: Check for stale sessions on page load
  async checkStaleSession() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    // Check if previous tab closed without logout
    const wasClosing = sessionStorage.getItem("tab_closing");
    if (wasClosing === "true") {
      // Previous session ended abruptly
      console.log("Detected stale session from previous tab");
      this.clearAuthData();
      sessionStorage.removeItem("tab_closing");
      return;
    }

    // Verify session is still valid on server
    const authStatus = await this.checkAuth();
    if (!authStatus.authenticated) {
      this.clearAuthData();
    }
  }

  // Check authentication status
  async checkAuth() {
    if (this.isChecking) return;

    this.isChecking = true;
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        this.notifyListeners(false, null);
        return { authenticated: false };
      }

      const response = await fetch(`${this.BASE_URL}/api/auth/check`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.notifyListeners(true, data.user);

        // Restart heartbeat if not running
        if (!this.heartbeatInterval) {
          this.setupHeartbeat();
        }

        return data;
      } else {
        this.clearAuthData();
        this.notifyListeners(false, null);
        this.stopHeartbeat();
        return { authenticated: false };
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      this.notifyListeners(false, null);
      return { authenticated: false };
    } finally {
      this.isChecking = false;
    }
  }

  // Login method
  async login(credentials) {
    try {
      const response = await fetch(`${this.BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...credentials,
          browserId: this.browserId,
        }),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok) {
        this.setAuthData(data);
        this.setupTabSync();
        this.setupHeartbeat(); // Start heartbeat
        this.triggerLoginThisUserOnly(data.user.email);
        return data;
      } else if (response.status === 409) {
        throw new Error(
          data.message ||
            "You are already logged in another browser/tab. Please logout there first."
        );
      } else {
        throw new Error(data.message || "Login failed");
      }
    } catch (error) {
      throw error;
    }
  }

  // Google login method
  async googleLogin(idToken) {
    try {
      const response = await fetch(`${this.BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          browserId: this.browserId,
        }),
        credentials: "include",
      });

      const data = await response.json();
      if (response.ok) {
        this.setAuthData(data);
        this.setupTabSync();
        this.setupHeartbeat(); // Start heartbeat
        this.triggerLoginThisUserOnly(data.user.email);
        return data;
      } else if (response.status === 409) {
        throw new Error(
          data.message ||
            "You are already logged in another browser/tab. Please logout there first."
        );
      } else {
        throw new Error(data.message || "Google login failed");
      }
    } catch (error) {
      throw error;
    }
  }

  // Logout method
  async logout() {
    try {
      const token = sessionStorage.getItem("token");
      const userEmail = sessionStorage.getItem("userEmail");

      this.stopHeartbeat(); // Stop heartbeat

      if (token) {
        await fetch(`${this.BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tabId: this.tabId,
            reason: "manual_logout",
          }),
          credentials: "include",
        });
      }

      this.clearAuthData();
      this.notifyListeners(false, null);
      this.triggerLogoutThisUserOnly(userEmail);
    } catch (error) {
      console.error("Logout error:", error);
      this.clearAuthData();
      this.notifyListeners(false, null);
    }
  }

  // Set auth data in sessionStorage
  setAuthData(data) {
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem(
      "userName",
      data.user?.name || data.user?.email.split("@")[0] || "User"
    );
    sessionStorage.setItem("userEmail", data.user?.email);
    sessionStorage.setItem("userLevel", data.user?.userLevel);
    sessionStorage.setItem("canOrder", data.user?.userLevel === "Customer");
    sessionStorage.removeItem("tab_closing"); // Clear any stale flag
  }

  // Clear auth data
  clearAuthData() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userLevel");
    sessionStorage.removeItem("canOrder");
    this.stopHeartbeat();
  }

  // Tab synchronization
  setupTabSync() {
    const currentUserEmail = sessionStorage.getItem("userEmail");

    window.addEventListener("storage", (event) => {
      if (event.key === "auth_logout") {
        try {
          const logoutData = JSON.parse(event.newValue);
          if (
            logoutData.email === currentUserEmail &&
            logoutData.tabId !== this.tabId
          ) {
            console.log("Logout detected for current user in another tab");
            this.clearAuthData();
            this.notifyListeners(false, null);
            window.location.reload();
          }
        } catch (e) {
          if (event.newValue) {
            this.clearAuthData();
            this.notifyListeners(false, null);
            window.location.reload();
          }
        }
      } else if (event.key === "auth_login") {
        try {
          const loginData = JSON.parse(event.newValue);
          if (
            loginData.email === currentUserEmail &&
            loginData.tabId !== this.tabId
          ) {
            console.log("Login detected for current user in another tab");
            this.checkAuth();
          }
        } catch (e) {
          this.checkAuth();
        }
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.checkAuth();
      }
    });
  }

  // Cross-tab communication
  triggerLogoutThisUserOnly(userEmail) {
    if (!userEmail) return;

    const logoutData = {
      email: userEmail,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    localStorage.setItem("auth_logout", JSON.stringify(logoutData));
    setTimeout(() => {
      localStorage.removeItem("auth_logout");
    }, 1000);
  }

  triggerLoginThisUserOnly(userEmail) {
    if (!userEmail) return;

    const loginData = {
      email: userEmail,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    localStorage.setItem("auth_login", JSON.stringify(loginData));
    setTimeout(() => {
      localStorage.removeItem("auth_login");
    }, 1000);
  }

  // Event listeners
  addAuthListener(callback) {
    this.authListeners.push(callback);
  }

  removeAuthListener(callback) {
    this.authListeners = this.authListeners.filter(
      (listener) => listener !== callback
    );
  }

  notifyListeners(isAuthenticated, user) {
    this.authListeners.forEach((listener) => {
      try {
        listener(isAuthenticated, user);
      } catch (error) {
        console.error("Auth listener error:", error);
      }
    });
  }

  // Get current auth state
  getAuthState() {
    const token = sessionStorage.getItem("token");
    return {
      isAuthenticated: !!token,
      user: {
        name: sessionStorage.getItem("userName"),
        email: sessionStorage.getItem("userEmail"),
        userLevel: sessionStorage.getItem("userLevel"),
        canOrder: sessionStorage.getItem("canOrder") === "true",
      },
    };
  }
}

// Create global instance
window.authService = new AuthService();
