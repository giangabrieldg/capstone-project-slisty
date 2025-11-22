function includeAdminSidebar() {
  const includeElements = document.querySelectorAll(
    "[data-include-admin-sidebar]"
  );

  includeElements.forEach((el) => {
    const file = el.getAttribute("data-include-admin-sidebar");
    if (file) {
      fetch(file)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
          }
          return response.text();
        })
        .then((data) => {
          el.innerHTML = data;
          el.removeAttribute("data-include-admin-sidebar");
          console.log("Sidebar loaded successfully");

          // DOM is ready — initialize sidebar
          requestAnimationFrame(() => {
            initializeAdminSidebar(el);
          });
        })
        .catch((error) =>
          console.error("Error including admin sidebar:", error)
        );
    }
  });
}

async function initializeAdminSidebar(container) {
  const sidebar = container.querySelector(".sidebar");
  const navLinks = container.querySelectorAll(".sidebar-nav .nav-item");
  const token = sessionStorage.getItem("token");

  // Validate user data
  const userData = await validateToken();
  console.log("User data from API:", userData);
  console.log("Token exists:", !!sessionStorage.getItem("token"));

  // Validate token on page load
  if (!token || !userData) {
    // Clear auth data but preserve browserId
    const browserId = localStorage.getItem("browserId");
    localStorage.clear();
    sessionStorage.clear();
    if (browserId) {
      localStorage.setItem("browserId", browserId);
    }
    window.location.href = "/customer/login.html";
    return;
  }

  updateUserInfo(container, userData);

  // Initialize sidebar notifications on ALL pages
  initializeSidebarNotifications(container);

  // Load notifications data on all pages
  await loadSidebarNotificationsData(container);

  // Set active nav link based on current path
  if (navLinks.length > 0) {
    const currentPath = window.location.pathname;

    navLinks.forEach((link) => {
      const linkPath = new URL(link.href, window.location.origin).pathname;

      if (link.id === "logoutLink") {
        link.classList.remove("active");
        return;
      }

      if (currentPath === linkPath) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    navLinks.forEach((link) => {
      link.addEventListener("click", function () {
        navLinks.forEach((nav) => nav.classList.remove("active"));
        this.classList.add("active");
      });
    });
  }

  // UPDATED: Enhanced logout functionality
  const logoutLink = container.querySelector("#logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();

      // Show confirmation dialog
      Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out of your account",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#2c9045",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, logout",
        cancelButtonText: "Cancel",
        reverseButtons: true,
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            // Use authService if available for proper logout
            if (window.authService) {
              await window.authService.logout();
            } else {
              // Manual logout process
              const token = sessionStorage.getItem("token");
              if (token) {
                try {
                  const BASE_URL =
                    window.API_BASE_URL ||
                    (window.location.hostname === "localhost"
                      ? "http://localhost:3000"
                      : "https://capstone-project-slisty.onrender.com");

                  await fetch(`${BASE_URL}/api/auth/logout`, {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                    credentials: "include",
                  });
                } catch (apiError) {
                  console.error("Backend logout failed:", apiError);
                }
              }

              // Clear storage but preserve browserId
              const browserId = localStorage.getItem("browserId");
              sessionStorage.clear();
              localStorage.clear();
              if (browserId) {
                localStorage.setItem("browserId", browserId);
              }
            }

            // Show success message
            Swal.fire({
              title: "Logged Out!",
              text: "You have been successfully logged out",
              icon: "success",
              timer: 1500,
              showConfirmButton: false,
              confirmButtonColor: "#2c9045",
            }).then(() => {
              // Trigger cross-tab logout notification
              const userEmail =
                sessionStorage.getItem("userEmail") ||
                localStorage.getItem("userEmail");
              if (userEmail) {
                const logoutData = {
                  email: userEmail,
                  timestamp: Date.now(),
                  type: "logout",
                };
                localStorage.setItem("auth_logout", JSON.stringify(logoutData));
                setTimeout(() => {
                  localStorage.removeItem("auth_logout");
                }, 100);
              }

              // Redirect to login page
              window.history.pushState(null, null, "/customer/login.html");
              window.location.href = "/customer/login.html";

              // Prevent back navigation
              window.addEventListener("popstate", () => {
                window.location.href = "/customer/login.html";
              });
            });
          } catch (error) {
            console.error("Logout error:", error);

            // Force client-side cleanup on error
            const browserId = localStorage.getItem("browserId");
            sessionStorage.clear();
            localStorage.clear();
            if (browserId) {
              localStorage.setItem("browserId", browserId);
            }

            Swal.fire({
              title: "Logged Out",
              text: "You have been logged out",
              icon: "info",
              timer: 2000,
              showConfirmButton: false,
            }).then(() => {
              window.location.href = "/customer/login.html";
            });
          }
        }
      });
    });
  } else {
    console.warn("Logout link not found.");
  }
}

// Load notifications data for sidebar
async function loadSidebarNotificationsData(container) {
  try {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    // Fetch notifications data
    const [
      dashboardResponse,
      customCakeData,
      imageBasedData,
      inquiriesResponse,
    ] = await Promise.all([
      fetch(`${window.API_BASE_URL}/api/orders/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/image-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${window.API_BASE_URL}/api/inquiries`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
    ]);

    const data = dashboardResponse.ok
      ? await dashboardResponse.json()
      : { success: false };
    const customCakeOrders = customCakeData.ok
      ? (await customCakeData.json()).orders || []
      : [];
    const imageBasedOrders = imageBasedData.ok
      ? (await imageBasedData.json()).orders || []
      : [];
    const inquiries = inquiriesResponse.ok
      ? await inquiriesResponse.json()
      : [];

    const pendingInquiries = inquiries.filter(
      (inquiry) => inquiry.status === "Pending"
    );

    if (data.success) {
      // Calculate notifications count
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

      const newCustomCakes = [
        ...customCakeOrders.filter((order) => {
          const orderDate = getOrderDate(order);
          return (
            orderDate >= thirtyMinutesAgo && order.status === "Downpayment Paid"
          );
        }),
        ...imageBasedOrders.filter((order) => {
          const orderDate = getOrderDate(order);
          return (
            orderDate >= thirtyMinutesAgo && order.status === "Downpayment Paid"
          );
        }),
      ];

      const notificationsData = {
        total:
          (data.notifications?.new_orders || 0) +
          (data.notifications?.pending_custom_cakes || 0) +
          newCustomCakes.length +
          pendingInquiries.length,
        new_orders: data.new_orders || [],
        new_custom_cakes: newCustomCakes,
        pending_custom_cakes: data.pending_custom_cakes || [],
        pending_inquiries: pendingInquiries,
      };

      // Update sidebar with the data
      updateSidebarNotificationsDisplay(container, notificationsData);
    }
  } catch (error) {
    console.error("Error loading sidebar notifications:", error);
  }
}

// Helper function to get order date
function getOrderDate(order) {
  if (order.orderDate) return new Date(order.orderDate);
  if (order.createdAt) return new Date(order.createdAt);
  if (order.updatedAt) return new Date(order.updatedAt);
  if (order.order_date) return new Date(order.order_date);
  return new Date();
}

// Update sidebar notifications display
function updateSidebarNotificationsDisplay(container, notificationsData) {
  const notificationsList = container.querySelector("#notificationsList");
  const notificationCount = container.querySelector(".notification-count");
  const notificationCountBadge = container.querySelector(
    ".notification-count-badge"
  );

  if (!notificationsList || !notificationCount || !notificationCountBadge)
    return;

  const totalNotifications = notificationsData.total;

  // Update both count badges
  notificationCount.textContent = totalNotifications;
  notificationCountBadge.textContent = totalNotifications;

  notificationCount.style.display =
    totalNotifications > 0 ? "inline-block" : "none";
  notificationCountBadge.style.display =
    totalNotifications > 0 ? "inline-block" : "none";

  // Update notifications list
  if (totalNotifications === 0) {
    notificationsList.innerHTML = `
      <div class="notification-empty-state">
        <i class="bi bi-check-circle text-muted"></i>
        <small class="text-muted">No new notifications</small>
      </div>
    `;
  } else {
    let notificationsHTML = "";

    // New regular orders
    if (notificationsData.new_orders.length > 0) {
      notificationsData.new_orders.slice(0, 3).forEach((order) => {
        notificationsHTML += `
          <div class="notification-item new-order">
            <div class="notification-content">
              <div class="notification-title">New Regular Order</div>
              <div class="notification-details">${order.orderId} - ${
          order.customer_name
        }</div>
              <div class="notification-time">${new Date(
                order.time
              ).toLocaleTimeString()}</div>
            </div>
          </div>
        `;
      });
    }

    // New custom cake orders
    if (notificationsData.new_custom_cakes.length > 0) {
      notificationsData.new_custom_cakes.slice(0, 3).forEach((cake) => {
        const cakeId = cake.customCakeId
          ? `CC${String(cake.customCakeId).padStart(3, "0")}`
          : cake.imageBasedOrderId
          ? `RCC${String(cake.imageBasedOrderId).padStart(3, "0")}`
          : "Custom Cake";
        const cakeType = cake.imageBasedOrderId ? "Image-Based" : "3D Custom";

        notificationsHTML += `
          <div class="notification-item new-custom-cake">
            <div class="notification-content">
              <div class="notification-title">New Custom Cake</div>
              <div class="notification-details">${cakeId} - ${
          cake.customer_name || "Unknown"
        }</div>
              <div class="notification-meta">${cakeType} • ${
          cake.size || "Not specified"
        }</div>
              <div class="notification-time">${new Date(
                cake.orderDate || cake.createdAt
              ).toLocaleTimeString()}</div>
            </div>
          </div>
        `;
      });
    }

    // Pending custom cakes
    if (notificationsData.pending_custom_cakes.length > 0) {
      notificationsData.pending_custom_cakes.slice(0, 2).forEach((cake) => {
        notificationsHTML += `
          <div class="notification-item pending-cake">
            <div class="notification-content">
              <div class="notification-title">Pending Custom Cake</div>
              <div class="notification-details">${
                cake.customCakeId
                  ? `CC${String(cake.customCakeId).padStart(3, "0")}`
                  : "Custom Cake"
              }</div>
              <div class="notification-meta">Status: ${cake.status}</div>
            </div>
          </div>
        `;
      });
    }

    // Pending Inquiries
    if (
      notificationsData.pending_inquiries &&
      notificationsData.pending_inquiries.length > 0
    ) {
      notificationsData.pending_inquiries.slice(0, 2).forEach((inquiry) => {
        notificationsHTML += `
          <div class="notification-item pending-inquiry">
            <div class="notification-content">
              <div class="notification-title">Pending Inquiry</div>
              <div class="notification-details">${inquiry.subject}</div>
              <div class="notification-meta">From: ${
                inquiry.User?.name || inquiry.name
              }</div>
              <div class="notification-time">${new Date(
                inquiry.createdAt
              ).toLocaleTimeString()}</div>
            </div>
          </div>
        `;
      });
    }

    // Show "view all" if there are more notifications
    const totalItems =
      (notificationsData.new_orders?.length || 0) +
      (notificationsData.new_custom_cakes?.length || 0) +
      (notificationsData.pending_custom_cakes?.length || 0) +
      (notificationsData.pending_inquiries?.length || 0);

    if (totalItems > 5) {
      notificationsHTML += `
        <div class="notification-view-all">
          <a href="admin-dashboard.html" class="btn btn-sm btn-outline-success w-100">
            View All Notifications
          </a>
        </div>
      `;
    }

    notificationsList.innerHTML = notificationsHTML;
  }
}

// Initialize sidebar notifications
// SIMPLE HYBRID SOLUTION
function initializeSidebarNotifications(container) {
  const notificationToggle = container.querySelector("#notificationToggle");
  const notificationDropdown = container.querySelector("#notificationDropdown");

  if (!notificationToggle || !notificationDropdown) return;

  // Use simple display toggle like the old version
  notificationDropdown.style.display = "none";

  notificationToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();

    const isVisible = notificationDropdown.style.display === "block";

    if (isVisible) {
      notificationDropdown.style.display = "none";
      notificationToggle.classList.remove("active");
    } else {
      notificationDropdown.style.display = "block";
      notificationToggle.classList.add("active");

      // Position it properly
      const toggleRect = notificationToggle.getBoundingClientRect();
      notificationDropdown.style.position = "fixed";
      notificationDropdown.style.top = `${toggleRect.bottom + 5}px`;
      notificationDropdown.style.left = `${toggleRect.left}px`;
      notificationDropdown.style.zIndex = "9999";
    }
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !notificationDropdown.contains(e.target) &&
      !notificationToggle.contains(e.target)
    ) {
      notificationDropdown.style.display = "none";
      notificationToggle.classList.remove("active");
    }
  });

  // Keep open when clicking inside
  notificationDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });
}

// Validate token with server
async function validateToken() {
  const token = sessionStorage.getItem("token");
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const userData = await response.json();
    if (!response.ok) {
      console.warn("Token validation failed with status:", response.status);
      return userData;
    }
    console.log("Token validation succeeded with status:", response.status);
    return userData;
  } catch (error) {
    console.error("Token validation failed:", error);
    return null;
  }
}

function updateUserInfo(container, userData) {
  const userNameElement = container.querySelector("#userName");
  const userRoleElement = container.querySelector("#userRole");

  if (userNameElement && userData.name) {
    userNameElement.textContent = userData.name;
  }
  if (userRoleElement && userData.userLevel) {
    userRoleElement.textContent = userData.userLevel;
  }
}

document.addEventListener("DOMContentLoaded", includeAdminSidebar);
