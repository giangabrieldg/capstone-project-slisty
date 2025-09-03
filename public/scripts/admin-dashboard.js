class AdminDashboard {
  constructor() {
    this.orders = [];
    this.summary = {};
    this.notifications = {
      total: 0,
      new_orders: 0,
      pending_custom_cakes: 0,
    };
    this.newOrders = [];
    this.pendingCustomCakes = [];
    this.lastUpdate = null;
    this.init();
  }

  async init() {
    await this.loadDashboardData();
    this.setupEventListeners();
    this.updateNotificationBadge();
    this.startAutoRefresh();
  }

  async loadDashboardData() {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login.html";
        return;
      }

      const response = await fetch("/api/orders/admin/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const data = await response.json();

      if (data.success) {
        this.orders = data.orders;
        this.summary = data.summary;
        this.notifications = data.notifications;
        this.newOrders = data.new_orders || [];
        this.pendingCustomCakes = data.pending_custom_cakes || [];
        this.lastUpdate = new Date();
        this.renderDashboard();

        // Show notification alert if there are new orders
        if (this.newOrders.length > 0) {
          this.showNewOrdersNotification();
        }
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      this.showError("Failed to load dashboard data");
    }
  }

  renderDashboard() {
    this.updateSummaryCards();
    this.renderOrdersTable();
    this.updateNotificationBadge();
    this.updateLastUpdateTime();
  }

  updateSummaryCards() {
    document.querySelector(
      '[data-summary="revenue"]'
    ).textContent = `PHP ${
      this.summary.total_revenue?.toFixed(2) || "0.00"
    }`;
    document.querySelector('[data-summary="orders"]').textContent =
      this.summary.total_orders || "0";
    document.querySelector('[data-summary="custom-cakes"]').textContent =
      this.summary.custom_cake_orders || "0";
    document.querySelector('[data-summary="customers"]').textContent =
      this.summary.new_customers || "0";
  }

  renderOrdersTable() {
    const tbody = document.getElementById("ordersTodayBody");
    if (!tbody) return;

    if (this.orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-muted">No orders for today</td>
        </tr>
      `;
      return;
    }

    const statusMap = {
      pending: { text: "Pending", class: "pending" },
      pending_payment: { text: "Pending Payment", class: "pending" },
      processing: { text: "In Progress", class: "in-progress" },
      shipped: { text: "Ready for Delivery", class: "ready" },
      delivered: { text: "Completed", class: "completed" },
      cancelled: { text: "Cancelled", class: "cancelled" },
    };

    tbody.innerHTML = this.orders
      .map((order) => {
        const orderDate = new Date(order.order_date);
        const formattedDate = `${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`;

        const statusInfo = statusMap[order.status_key] || {
          text: order.status,
          class: "pending",
        };

        const items = order.items
          .map(
            (item) =>
              `${item.name}${
                item.size ? ` (${item.size})` : ""
              }<br>Qty: ${item.quantity}`
          )
          .join("<br>");

        // Check if this is a new order (last 30 minutes)
        const isNewOrder = this.newOrders.some(
          (newOrder) => newOrder.orderId === order.orderId
        );
        const rowClass = isNewOrder ? "new-order" : "";

        return `
        <tr class="${rowClass}">
          <td>#${order.orderId}</td>
          <td>
            <div class="customer-info">
              <div class="customer-name">${order.customer_name}</div>
              <div class="customer-email small text-muted">${
                order.customer_email || "No email"
              }</div>
            </div>
          </td>
          <td>${formattedDate}</td>
          <td>${
            order.delivery_method.charAt(0).toUpperCase() +
            order.delivery_method.slice(1)
          }</td>
          <td>PHP ${order.total_amount.toFixed(2)}</td>
          <td>${
            order.payment_method.charAt(0).toUpperCase() +
            order.payment_method.slice(1)
          }</td>
          <td>${items}</td>
          <td><span class="status ${statusInfo.class}">${
                statusInfo.text
              }</span></td>
        </tr>
      `;
      })
      .join("");
  }

  updateNotificationBadge() {
    const notificationCount = document.querySelector(
      ".notification-count"
    );
    const notificationIcon = document.querySelector(".notification i");

    if (notificationCount) {
      notificationCount.textContent = this.notifications.total;
      notificationCount.style.display =
        this.notifications.total > 0 ? "flex" : "none";
    }

    // Change icon color if there are notifications
    if (notificationIcon) {
      if (this.notifications.total > 0) {
        notificationIcon.classList.add("text-warning");
        notificationIcon.classList.remove("text-muted");
      } else {
        notificationIcon.classList.remove("text-warning");
        notificationIcon.classList.add("text-muted");
      }
    }
  }

  updateLastUpdateTime() {
    const updateElement = document.querySelector("[data-last-update]");
    if (updateElement && this.lastUpdate) {
      updateElement.textContent = this.lastUpdate.toLocaleTimeString();
    }
  }

  showNewOrdersNotification() {
    if (this.newOrders.length > 0) {
      const notification = document.createElement("div");
      notification.className =
        "alert alert-info alert-dismissible fade show";
      notification.innerHTML = `
        <i class="bi bi-bell-fill me-2"></i>
        <strong>${this.newOrders.length} new order(s)</strong> in the last 30 minutes
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.querySelector(".content").prepend(notification);

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    }
  }

  showNotificationsModal() {
    // Create modal for notifications
    const modalHtml = `
      <div class="modal fade" id="notificationsModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Notifications</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              ${this.getNotificationsContent()}
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById("notificationsModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add new modal to body
    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(
      document.getElementById("notificationsModal")
    );
    modal.show();
  }

  getNotificationsContent() {
    let content = "";

    if (this.newOrders.length > 0) {
      content += `
        <div class="mb-4">
          <h6><i class="bi bi-cart-plus text-primary me-2"></i> New Orders (${
            this.newOrders.length
          })</h6>
          <div class="list-group">
            ${this.newOrders
              .map(
                (order) => `
              <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>#${order.orderId}</strong> - ${order.customer_name}
                    <br><small class="text-muted">${order.items}</small>
                  </div>
                  <small class="text-muted">${new Date(
                    order.time
                  ).toLocaleTimeString()}</small>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (this.pendingCustomCakes.length > 0) {
      content += `
        <div>
          <h6><i class="bi bi-cake text-warning me-2"></i> Pending Custom Cakes (${
            this.pendingCustomCakes.length
          })</h6>
          <div class="list-group">
            ${this.pendingCustomCakes
              .map(
                (cake) => `
              <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div>
                    <strong>Custom Cake Order</strong>
                    <br><small class="text-muted">Size: ${cake.size}, Status: ${cake.status}</small>
                  </div>
                  <span class="badge bg-warning">Pending</span>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `;
    }

    if (content === "") {
      content = '<p class="text-center text-muted">No notifications</p>';
    }

    return content;
  }

  setupEventListeners() {
    // Notification click handler
    document
      .querySelector(".notification")
      .addEventListener("click", () => {
        this.showNotificationsModal();
      });

    // Refresh button
    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn btn-sm btn-outline-primary ms-3 custom-outline-green";
    refreshBtn.innerHTML =
      '<i class="bi bi-arrow-clockwise"></i> Refresh';
    refreshBtn.addEventListener("click", () => this.loadDashboardData());
    document.querySelector(".dashboard-header").appendChild(refreshBtn);
  }

  startAutoRefresh() {
    // Refresh data every 2 minutes
    setInterval(() => {
      this.loadDashboardData();
    }, 2 * 60 * 1000);
  }

  showError(message) {
    const alert = document.createElement("div");
    alert.className = "alert alert-danger alert-dismissible fade show";
    alert.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector(".content").prepend(alert);
  }
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
  new AdminDashboard();
});