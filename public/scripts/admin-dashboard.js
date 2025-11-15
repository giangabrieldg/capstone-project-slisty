class AdminDashboard {
  constructor() {
    this.orders = [];
    this.summary = {};
    this.notifications = {
      total: 0,
      new_orders: 0,
      pending_custom_cakes: 0,
      new_custom_cakes: 0,
      pending_inquiries: 0,
    };
    this.newOrders = [];
    this.pendingCustomCakes = [];
    this.newCustomCakes = [];
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
      const token = sessionStorage.getItem("token");
      if (!token) {
        window.location.href = "/login.html";
        return;
      }

      // Fetch all data in parallel - ADD INQUIRIES HERE
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
        //Fetch pending inquiries
        fetch(`${window.API_BASE_URL}/api/inquiries`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!dashboardResponse.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const data = await dashboardResponse.json();
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
        // today's date for filtering
        const today = new Date();
        const todayStart = new Date(
          Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
        );
        const todayEnd = new Date(
          Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)
        );

        // Get time 30 minutes ago for new orders
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        // Helper function to check if order is from today (considers timezone)
        const isOrderFromToday = (orderDate) => {
          const orderLocalDate = new Date(orderDate);
          const todayLocal = new Date();

          return (
            orderLocalDate.getDate() === todayLocal.getDate() &&
            orderLocalDate.getMonth() === todayLocal.getMonth() &&
            orderLocalDate.getFullYear() === todayLocal.getFullYear()
          );
        };

        const todaysCustomCakeOrders = customCakeOrders.filter((order) => {
          const orderDate = this.getOrderDate(order);
          const isToday = isOrderFromToday(orderDate);
          const statuses = [
            "Downpayment Paid",
            "In Progress",
            "Ready for Pickup/Delivery",
            "Completed",
          ];
          return isToday && statuses.includes(order.status);
        });

        const todaysImageBasedOrders = imageBasedOrders.filter((order) => {
          const orderDate = this.getOrderDate(order);
          const isToday = isOrderFromToday(orderDate);
          const statuses = [
            "Downpayment Paid",
            "In Progress",
            "Ready for Pickup/Delivery",
            "Completed",
          ];
          return isToday && statuses.includes(order.status);
        });

        this.newCustomCakes = [
          ...customCakeOrders.filter((order) => {
            const orderDate = this.getOrderDate(order);
            return (
              orderDate >= thirtyMinutesAgo &&
              order.status === "Downpayment Paid"
            );
          }),
          ...imageBasedOrders.filter((order) => {
            const orderDate = this.getOrderDate(order);
            return (
              orderDate >= thirtyMinutesAgo &&
              order.status === "Downpayment Paid"
            );
          }),
        ];

        // Combine all orders
        const allOrders = [
          ...data.orders.map((order) => ({ ...order, order_type: "regular" })),
          ...this.formatCustomCakeOrdersForDashboard(
            todaysCustomCakeOrders,
            "CC"
          ),
          ...this.formatCustomCakeOrdersForDashboard(
            todaysImageBasedOrders,
            "RCC"
          ),
        ];

        // Sort all orders by date (newest first)
        allOrders.sort(
          (a, b) => new Date(b.order_date) - new Date(a.order_date)
        );

        this.orders = allOrders;
        this.summary = data.summary;

        // Update notifications to include custom cakes
        this.notifications = {
          ...data.notifications,
          new_custom_cakes: this.newCustomCakes.length,
          pending_inquiries: pendingInquiries.length,
          total:
            (data.notifications.new_orders || 0) +
            (data.notifications.pending_custom_cakes || 0) +
            this.newCustomCakes.length +
            pendingInquiries.length,
        };

        this.newOrders = data.new_orders || [];
        this.pendingCustomCakes = data.pending_custom_cakes || [];
        this.pendingInquiries = pendingInquiries;
        this.lastUpdate = new Date();

        // Update summary with today's custom cake counts (only paid ones)
        this.summary.total_custom_cakes =
          todaysCustomCakeOrders.length + todaysImageBasedOrders.length;
        this.summary.custom_cake_3d_orders = todaysCustomCakeOrders.length;
        this.summary.custom_cake_image_orders = todaysImageBasedOrders.length;

        this.renderDashboard();

        // Show notification alert if there are new orders (regular or custom)
        if (this.newOrders.length > 0 || this.newCustomCakes.length > 0) {
          this.showNewOrdersNotification();
        }
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
      this.showError("Failed to load dashboard data");
    }
  }

  // Helper method to filter today's orders
  filterTodaysOrders(orders, todayStart, todayEnd) {
    return orders.filter((order) => {
      const orderDate = this.getOrderDate(order);
      return orderDate >= todayStart && orderDate < todayEnd;
    });
  }

  // Helper method to get order date from different date fields
  getOrderDate(order) {
    if (order.orderDate) return new Date(order.orderDate);
    if (order.createdAt) return new Date(order.createdAt);
    if (order.updatedAt) return new Date(order.updatedAt);
    if (order.order_date) return new Date(order.order_date);
    return new Date();
  }

  // Format custom cake orders for dashboard display
  formatCustomCakeOrdersForDashboard(orders, prefix) {
    return orders.map((order) => {
      const isImageBased = prefix === "RCC";
      const orderId = isImageBased
        ? order.imageBasedOrderId
        : order.customCakeId;
      const orderDate = this.getOrderDate(order);

      // Ensure price is a number
      const totalAmount = order.price ? parseFloat(order.price) : 0;

      return {
        orderId: `${prefix}${String(orderId).padStart(3, "0")}`,
        customer_name: order.customer_name || order.customer?.name || "Unknown",
        customer_email:
          order.customer_email || order.customer?.email || "No email",
        total_amount: totalAmount,
        status: order.status,
        status_key: this.mapCustomCakeStatus(order.status),
        order_date: orderDate,
        delivery_method: order.delivery_method || "pickup",
        payment_method: "gcash", // Custom cakes use GCash for downpayment
        items: [
          {
            name: isImageBased ? "Image-Based Custom Cake" : "3D Custom Cake",
            size: order.size || "Not specified",
            quantity: 1,
            price: totalAmount,
            customCakeId: orderId,
            is_custom_cake: true,
            is_image_based: isImageBased,
          },
        ],
        order_type: isImageBased ? "image_cake" : "custom_cake",
        is_custom_cake: true,
        is_image_based: isImageBased,
      };
    });
  }

  //Map custom cake status to regular order status for styling
  mapCustomCakeStatus(customCakeStatus) {
    // Return the actual status text instead of keys
    return customCakeStatus;
  }

  renderDashboard() {
    this.updateSummaryCards();
    this.renderOrdersTable();
    this.updateNotificationBadge();
    this.updateLastUpdateTime();
  }

  updateSummaryCards() {
    // Revenue - from regular orders only
    document.querySelector('[data-summary="revenue"]').textContent = `PHP ${(
      this.summary.total_revenue || 0
    ).toFixed(2)}`;

    // Total Orders - from regular orders only
    document.querySelector('[data-summary="orders"]').textContent =
      this.summary.total_orders || 0;

    // Custom Cakes - Today's total (separate from regular orders)
    const customCakesElement = document.querySelector(
      '[data-summary="custom-cakes"]'
    );
    const totalCustomCakes = this.summary.total_custom_cakes || 0;
    const customCake3DCount = this.summary.custom_cake_3d_orders || 0;
    const imageBasedCount = this.summary.custom_cake_image_orders || 0;

    customCakesElement.textContent = totalCustomCakes;
    customCakesElement.title = `Today's Custom Cakes:\n3D Custom: ${customCake3DCount}\nImage-based: ${imageBasedCount}`;
    customCakesElement.setAttribute("data-bs-toggle", "tooltip");
    customCakesElement.setAttribute("data-bs-placement", "top");

    // Customers
    document.querySelector('[data-summary="customers"]').textContent =
      this.summary.new_customers || "0";

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
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

    // Use the comprehensive status map
    const statusMap = {
      "Pending Review": { class: "pending", text: "Pending Review" },
      "Ready for Downpayment": {
        class: "ready-for-dp",
        text: "Ready for Downpayment",
      },
      "Downpayment Paid": { class: "dp-paid", text: "Downpayment Paid" },
      "Order Received": { class: "order-received", text: "Order Received" },
      "In Progress": { class: "in-progress", text: "In Progress" },
      "Ready for Pickup/Delivery": {
        class: "ready",
        text: "Ready for Pickup/Delivery",
      },
      Completed: { class: "delivered", text: "Completed" },
      Cancelled: { class: "cancelled", text: "Cancelled" },
      "Not Feasible": { class: "cancelled", text: "Not Feasible" },
    };

    tbody.innerHTML = this.orders
      .map((order) => {
        const orderDate = new Date(order.order_date);
        const formattedDate = `${orderDate.toLocaleDateString()} ${orderDate.toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`;

        // Use order.status directly with the comprehensive map
        const statusInfo = statusMap[order.status] || {
          text: order.status,
          class: "pending",
        };

        const items = order.items
          .map(
            (item) =>
              `${item.name}${item.size ? ` (${item.size})` : ""}<br>Qty: ${
                item.quantity
              }`
          )
          .join("<br>");

        // Check if this is a new order
        const isNewOrder =
          this.newOrders.some(
            (newOrder) => newOrder.orderId === order.orderId
          ) ||
          this.newCustomCakes.some((newCake) => {
            const cakeId = newCake.customCakeId
              ? `CC${String(newCake.customCakeId).padStart(3, "0")}`
              : newCake.imageBasedOrderId
              ? `RCC${String(newCake.imageBasedOrderId).padStart(3, "0")}`
              : "";
            return cakeId === order.orderId;
          });

        const rowClass = isNewOrder ? "new-order" : "";

        // Format order ID with appropriate prefix and styling
        const orderIdCell = this.getOrderIdCell(order);

        // Ensure total_amount is a number
        const totalAmount =
          typeof order.total_amount === "number"
            ? order.total_amount
            : parseFloat(order.total_amount) || 0;

        // Payment method display
        const paymentMethodDisplay =
          order.payment_method === "gcash"
            ? "GCash"
            : order.payment_method === "cash"
            ? "Cash"
            : "Custom Cake";

        return `
        <tr class="${rowClass}">
          <td>${orderIdCell}</td>
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
          <td>PHP ${totalAmount.toFixed(2)}</td>
          <td>${paymentMethodDisplay}</td>
          <td>${items}</td>
          <td><span class="status ${statusInfo.class}">${
          statusInfo.text
        }</span></td>
        </tr>
      `;
      })
      .join("");

    this.addOrderTypeStyles();
  }

  // Generate order ID cell with appropriate styling
  getOrderIdCell(order) {
    if (order.order_type === "custom_cake") {
      return `<span class="order-id custom-cake-id" title="3D Custom Cake">${order.orderId}</span>`;
    } else if (order.order_type === "image_cake") {
      return `<span class="order-id image-cake-id" title="Image-Based Custom Cake">${order.orderId}</span>`;
    } else {
      return `<span class="order-id regular-id">${order.orderId}</span>`;
    }
  }

  // Add CSS for different order type styling
  addOrderTypeStyles() {
    if (!document.getElementById("order-type-styles")) {
      const style = document.createElement("style");
      style.id = "order-type-styles";
      style.textContent = `
        .order-id {
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
        }
        .new-order {
          background-color: #f0f8f5 !important;
          border-left: 4px solid #2c9045;
        }

        .new-order .order-id.regular-id {
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  updateNotificationBadge() {
    // Dashboard notification badge
    const dashboardNotificationCount = document.querySelector(
      ".content .notification-count" // More specific selector for dashboard
    );

    // Sidebar notification badge (the one in the bell icon)
    const sidebarNotificationCount = document.querySelector(
      ".sidebar-header .notification-count"
    );

    // Sidebar notification badge (in the section header)
    const sidebarNotificationBadge = document.querySelector(
      ".notification-count-badge"
    );

    // Update dashboard badge
    if (dashboardNotificationCount) {
      dashboardNotificationCount.textContent = this.notifications.total;
      dashboardNotificationCount.style.display =
        this.notifications.total > 0 ? "flex" : "none";
    }

    // Update sidebar notification count (bell icon)
    if (sidebarNotificationCount) {
      sidebarNotificationCount.textContent = this.notifications.total;
      sidebarNotificationCount.style.display =
        this.notifications.total > 0 ? "inline-block" : "none";
    }

    // Update sidebar notification badge (section header)
    if (sidebarNotificationBadge) {
      sidebarNotificationBadge.textContent = this.notifications.total;
      sidebarNotificationBadge.style.display =
        this.notifications.total > 0 ? "inline-block" : "none";
    }

    // Change icon color if there are notifications
    const notificationIcon = document.querySelector(".notification i");
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
    const totalNewOrders = this.newOrders.length + this.newCustomCakes.length;
    if (totalNewOrders > 0) {
      const notification = document.createElement("div");
      notification.className = "alert alert-info alert-dismissible fade show";

      let message = "";
      if (this.newOrders.length > 0 && this.newCustomCakes.length > 0) {
        message = `<strong>${this.newOrders.length} new regular order(s)</strong> and <strong>${this.newCustomCakes.length} new custom cake order(s)</strong> in the last 30 minutes`;
      } else if (this.newOrders.length > 0) {
        message = `<strong>${this.newOrders.length} new regular order(s)</strong> in the last 30 minutes`;
      } else {
        message = `<strong>${this.newCustomCakes.length} new custom cake order(s)</strong> in the last 30 minutes`;
      }

      notification.innerHTML = `
        <i class="bi bi-bell-fill me-2"></i>
        ${message}
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
        <h6><i class="bi bi-cart-plus text-primary me-2"></i> New Regular Orders (${
          this.newOrders.length
        })</h6>
        <div class="list-group">
          ${this.newOrders
            .map(
              (order) => `
              <div class="list-group-item notification-item">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1">
                    <strong>${order.orderId}</strong> - ${order.customer_name}
                    <br><small class="text-muted">${order.items}</small>
                  </div>
                  <small class="text-muted text-nowrap ms-2">${new Date(
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

    if (this.newCustomCakes.length > 0) {
      content += `
      <div class="mb-4">
        <h6><i class="bi bi-cake2 text-success me-2"></i> New Custom Cake Orders (${
          this.newCustomCakes.length
        })</h6>
        <div class="list-group">
          ${this.newCustomCakes
            .map(
              (cake) => `
              <div class="list-group-item notification-item">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1 me-3">
                    <strong>${this.formatCustomCakeId(cake)}</strong> - ${
                cake.customer_name || "Unknown Customer"
              }
                    <br><small class="text-muted">Size: ${
                      cake.size || "Not specified"
                    }, Type: ${
                cake.imageBasedOrderId ? "Image-Based" : "3D Custom"
              }</small>
                  </div>
                  <div class="text-end text-nowrap">
                    <small class="text-muted">${this.getOrderDate(
                      cake
                    ).toLocaleTimeString()}</small>
                    <br><span class="badge bg-success">Downpayment Paid</span>
                  </div>
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
      <div class="mb-4">
        <h6><i class="bi bi-cake text-warning me-2"></i> Pending Custom Cakes (${
          this.pendingCustomCakes.length
        })</h6>
        <div class="list-group">
          ${this.pendingCustomCakes
            .map(
              (cake) => `
              <div class="list-group-item notification-item">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1 me-3">
                    <strong>${this.formatCustomCakeId(cake)}</strong>
                    <br><small class="text-muted">Size: ${cake.size}, Status: ${
                cake.status
              }</small>
                  </div>
                  <span class="badge bg-warning text-nowrap">Pending</span>
                </div>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `;
    }

    if (this.pendingInquiries && this.pendingInquiries.length > 0) {
      content += `
    <div class="mb-4">
      <h6><i class="bi bi-question-circle text-info me-2"></i> Pending Inquiries (${
        this.pendingInquiries.length
      })</h6>
      <div class="list-group">
        ${this.pendingInquiries
          .map(
            (inquiry) => `
              <div class="list-group-item notification-item">
                <div class="d-flex justify-content-between align-items-start">
                  <div class="flex-grow-1 me-3">
                    <strong>${inquiry.subject}</strong> - ${
              inquiry.User?.name || inquiry.name
            }
                    <br><small class="text-muted">${inquiry.email} | ${
              inquiry.phone
            }</small>
                    <br><small class="text-muted notification-message">${
                      inquiry.message
                    }</small>
                  </div>
                  <span class="badge bg-secondary text-nowrap">Pending Reply</span>
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

  // Helper method to format custom cake IDs
  formatCustomCakeId(cake) {
    if (cake.customCakeId) {
      return `<span style="color: #e91e63; font-weight: bold;">CC${String(
        cake.customCakeId
      ).padStart(3, "0")}</span>`;
    }
    if (cake.imageBasedOrderId) {
      return `<span style="color: #ff9800; font-weight: bold;">RCC${String(
        cake.imageBasedOrderId
      ).padStart(3, "0")}</span>`;
    }
    return `Custom Cake Order`;
  }

  setupEventListeners() {
    // Notification click handler
    const notificationElement = document.querySelector(".notification");
    if (notificationElement) {
      notificationElement.addEventListener("click", () => {
        this.showNotificationsModal();
      });
    }
  }

  startAutoRefresh() {
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

    const contentElement = document.querySelector(".content");
    if (contentElement) {
      contentElement.prepend(alert);
    }
  }
}

// Initialize dashboard when page loads
document.addEventListener("DOMContentLoaded", () => {
  new AdminDashboard();
});
