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
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/customer/login.html";
    return;
  }

  updateUserInfo(container, userData);

  // Initialize sidebar notifications on ALL pages
  initializeSidebarNotifications(container);

  // Load notifications data on all pages
  await loadSidebarNotificationsData(container);

  // REMOVED: Toggle button functionality since sidebar is always visible

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

  // Logout Handler
  const logoutLink = container.querySelector("#logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      window.history.pushState(null, null, "/customer/login.html");
      window.location.href = "/customer/login.html";
      window.addEventListener("popstate", () => {
        window.location.href = "/customer/login.html";
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
    const [dashboardResponse, customCakeData, imageBasedData] =
      await Promise.all([
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
          newCustomCakes.length,
        new_orders: data.new_orders || [],
        new_custom_cakes: newCustomCakes,
        pending_custom_cakes: data.pending_custom_cakes || [],
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
            <div class="notification-icon">
              <i class="bi bi-cart-plus text-primary"></i>
            </div>
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
            <div class="notification-icon">
              <i class="bi bi-cake2 text-success"></i>
            </div>
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
            <div class="notification-icon">
              <i class="bi bi-clock text-warning"></i>
            </div>
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

    // Show "view all" if there are more notifications
    const totalItems =
      notificationsData.new_orders.length +
      notificationsData.new_custom_cakes.length +
      notificationsData.pending_custom_cakes.length;
    if (totalItems > 5) {
      notificationsHTML += `
        <div class="notification-view-all">
          <a href="admin-dashboard.html" class="btn btn-sm btn-outline-primary w-100">
            View All Notifications
          </a>
        </div>
      `;
    }

    notificationsList.innerHTML = notificationsHTML;
  }
}

// Initialize sidebar notifications
function initializeSidebarNotifications(container) {
  const notificationToggle = container.querySelector("#notificationToggle");
  const notificationsSection = container.querySelector("#notificationsSection");
  const notificationsList = container.querySelector("#notificationsList");

  if (notificationToggle && notificationsSection) {
    // Initialize with hidden state
    notificationsSection.classList.add("hidden");

    notificationToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = notificationsSection.classList.contains("visible");

      if (isVisible) {
        notificationsSection.classList.remove("visible");
        notificationsSection.classList.add("hidden");
        notificationToggle.classList.remove("active");
      } else {
        notificationsSection.classList.remove("hidden");
        notificationsSection.classList.add("visible");
        notificationToggle.classList.add("active");
      }
    });

    // Close notifications when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !notificationsSection.contains(e.target) &&
        !notificationToggle.contains(e.target)
      ) {
        notificationsSection.classList.remove("visible");
        notificationsSection.classList.add("hidden");
        notificationToggle.classList.remove("active");
      }
    });

    // Add click handlers for notification items
    if (notificationsList) {
      notificationsList.addEventListener("click", (e) => {
        const notificationItem = e.target.closest(".notification-item");
        if (notificationItem) {
          // Navigate to dashboard when clicking any notification
          window.location.href = "admin-dashboard.html";
        }
      });
    }
  }
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
