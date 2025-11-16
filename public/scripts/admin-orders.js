/**
 * handles fetching, updating, and filtering orders for admin/staff
 */
class AdminOrdersManager {
  constructor() {
    this.orders = [];
    this.init();
  }

  // initializes event listeners and fetches orders
  init() {
    document.addEventListener("DOMContentLoaded", () => {
      this.fetchUserInfo();
      this.fetchOrders();
      this.setupEventListeners();
    });
  }

  // Fetches user info to display in sidebar
  async fetchUserInfo() {
    const token = sessionStorage.getItem("token");
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.user) {
        document.getElementById("userName").textContent =
          data.user.name || "Admin Name";
        document.getElementById("userRole").textContent =
          data.user.userLevel === "admin" ? "Admin" : "Staff";
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  }

  // Fetches orders from backend
  async fetchOrders() {
    const token = sessionStorage.getItem("token");
    if (!token) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Please login as admin or staff",
        confirmButtonColor: "#2c9045",
      });
      window.location.href = "/index.html";
      return;
    }
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/orders/admin/orders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      this.orders = data.orders;
      this.renderOrders(this.orders);
      this.applyFilters();
    } catch (error) {
      console.error("Error fetching orders:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Failed to load orders: ${error.message}`,
        confirmButtonColor: "#2c9045",
      });
    }
  }

  // Renders orders in the table
  // Renders orders in the table
  renderOrders(orders) {
    const tbody = document.getElementById("ordersTableBody");
    if (!tbody) return;

    // Additional frontend filtering for safety
    const normalOrders = orders.filter((order) => {
      return !order.items.some((item) => item.customCakeId);
    });

    tbody.innerHTML = normalOrders
      .map((order) => {
        const statusMap = {
          pending: "Pending",
          pending_payment: "Pending Payment",
          order_received: "Order Received",
          processing: "In Progress",
          shipped: "Ready for Pickup/Delivery",
          delivered: "Completed",
          cancelled: "Cancelled",
        };

        // Define the next status for each current status
        const nextStatusMap = {
          pending: "order_received",
          pending_payment: "order_received",
          order_received: "processing",
          processing: "shipped",
          shipped: "delivered",
          // delivered and cancelled have no next status
        };

        const nextStatus = nextStatusMap[order.status];
        const nextStatusText = nextStatus ? statusMap[nextStatus] : null;

        const paymentStatus =
          order.payment_method === "cash"
            ? order.status === "delivered"
              ? "paid"
              : "unpaid"
            : order.payment_verified
            ? "paid"
            : "unpaid";
        const paymentMethod =
          order.payment_method === "gcash" ? "GCash" : "Cash";

        // Format order date and pickup date similarly
        const orderDate = order.createdAt.split("T")[0];
        const pickupDate = order.pickup_date
          ? order.pickup_date.split("T")[0]
          : "Not set";

        // Format customer details with delivery address
        const customerDetails = `
      <div class="customer-info">
        <div class="customer-name fw-bold">${order.customer_name}</div>
        <div class="customer-contact small text-muted">
          ${order.customer_email}<br>${order.customer_phone}
        </div>
        <div class="delivery-method small text-muted mt-1">
          <strong>Method:</strong> ${
            order.delivery_method.charAt(0).toUpperCase() +
            order.delivery_method.slice(1)
          }
        </div>
        ${
          order.delivery_method === "delivery" && order.delivery_address
            ? `
          <div class="delivery-address small text-muted mt-1">
            <strong>Delivery Address:</strong><br>
            ${order.delivery_address}
          </div>
        `
            : ""
        }
        <div class="payment-method small text-muted mt-1">
          <strong>Payment:</strong> ${paymentMethod} 
          <span class="status ${paymentStatus}">${
          paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)
        }</span>
        </div>
      </div>
    `;

        // Format items with size information (only regular menu items)
        const items = order.items
          .filter((item) => !item.customCakeId)
          .map((item) => {
            const sizeInfo = item.size ? `Size: ${item.size}<br>` : "";
            return `${item.name}<br>${sizeInfo}Qty: ${item.quantity} - PHP ${(
              item.price * item.quantity
            ).toFixed(2)}`;
          })
          .join("<br><br>");

        // Skip orders that have no regular items after filtering
        if (items.length === 0) {
          return "";
        }

        // Format updated by information
        const updatedByInfo = order.updater
          ? `
      <div class="updated-by-info">
        <div class="updater-name fw-bold">${order.updater.name}</div>
        <div class="updater-role small text-muted">
          ${order.updater.userLevel}
        </div>
        ${
          order.updatedAt
            ? `
          <div class="update-time small text-muted">
            ${new Date(order.updatedAt).toLocaleDateString()} 
            ${new Date(order.updatedAt).toLocaleTimeString()}
          </div>
        `
            : ""
        }
      </div>
    `
          : `
      <div class="updated-by-info">
        <div class="text-muted small">Not updated yet</div>
      </div>
    `;

        return `
      <tr data-order-date="${orderDate}">
        <td>ORD${order.orderId.toString().padStart(3, "0")}</td>
        <td>${customerDetails}</td>
        <td>${orderDate}</td>
        <td>${pickupDate}</td>
        <td>PHP ${Number(order.total_amount).toFixed(2)}</td>
        <td>${items}</td>
        <td>${
          order.delivery_method.charAt(0).toUpperCase() +
          order.delivery_method.slice(1)
        }</td>
        <td><span class="status ${order.status}">${
          statusMap[order.status]
        }</span></td>
        <td>${updatedByInfo}</td> <!-- NEW COLUMN -->
        <td>
          ${
            nextStatus
              ? `
            <button class="btn btn-primary btn-sm update-status-btn" data-order-id="${order.orderId}" data-next-status="${nextStatus}">
              Mark as ${nextStatusText}
            </button>
          `
              : `
            <span class="text-muted small">No further actions</span>
          `
          }
          ${
            order.status !== "cancelled" && order.status !== "delivered"
              ? `
            <button class="btn btn-outline-danger btn-sm cancel-order-btn" data-order-id="${order.orderId}">
              Cancel Order
            </button>
          `
              : ""
          }
        </td>
      </tr>
    `;
      })
      .join("");
  }

  setupEventListeners() {
    // Search
    document
      .querySelector(".search-bar")
      .addEventListener("input", () => this.applyFilters());
    // Date picker
    document
      .getElementById("datePicker")
      .addEventListener("change", () => this.applyFilters());
    // Filter modal
    document.getElementById("applyFilter").addEventListener("click", () => {
      this.applyFilters();
      bootstrap.Modal.getInstance(
        document.getElementById("filterModal")
      ).hide();
    });

    // Update status and cancel order (delegated events)
    document
      .getElementById("ordersTableBody")
      .addEventListener("click", (e) => {
        const updateBtn = e.target.closest(".update-status-btn");
        const cancelBtn = e.target.closest(".cancel-order-btn");

        if (updateBtn) {
          const orderId = updateBtn.getAttribute("data-order-id");
          const nextStatus = updateBtn.getAttribute("data-next-status");
          this.updateOrderStatus(orderId, nextStatus);
        } else if (cancelBtn) {
          const orderId = cancelBtn.getAttribute("data-order-id");
          this.cancelOrder(orderId);
        }
      });
  }

  //Applies search and filter functionality
  applyFilters() {
    const searchTerm = document
      .querySelector(".search-bar")
      .value.toLowerCase();
    const selectedDate = document.getElementById("datePicker").value;
    const selectedPickupDate =
      document.getElementById("filterPickupDate").value;
    const status = document.getElementById("filterStatus").value.toLowerCase();
    const paymentStatus = document
      .getElementById("filterPaymentStatus")
      .value.toLowerCase();

    const filteredOrders = this.orders.filter((order) => {
      const orderId = `#ORD${order.orderId
        .toString()
        .padStart(3, "0")}`.toLowerCase();
      const customerName = order.customer_name.toLowerCase();
      const amount = `PHP ${Number(order.total_amount).toFixed(
        2
      )}`.toLowerCase();
      const rowOrderDate = order.createdAt.split("T")[0];
      const rowPickupDate = order.pickup_date
        ? order.pickup_date.split("T")[0]
        : null;
      const rowStatus = order.status.toLowerCase();

      // Calculate payment status based on payment method and verification
      const rowPaymentStatus =
        order.payment_method === "cash"
          ? order.status === "delivered"
            ? "paid"
            : "unpaid"
          : order.payment_verified
          ? "paid"
          : "unpaid";

      // Exact date match: only include orders from the selected date
      const dateMatch = !selectedDate || rowOrderDate === selectedDate;
      const pickupDateMatch =
        !selectedPickupDate || rowPickupDate === selectedPickupDate;
      const searchMatch =
        orderId.includes(searchTerm) ||
        customerName.includes(searchTerm) ||
        amount.includes(searchTerm);
      const statusMatch = !status || order.status === status;
      const paymentStatusMatch =
        !paymentStatus || rowPaymentStatus === paymentStatus;

      return (
        dateMatch &&
        pickupDateMatch &&
        searchMatch &&
        statusMatch &&
        paymentStatusMatch
      );
    });

    this.renderOrders(filteredOrders);
  }

  // Updates order status
  async updateOrderStatus(orderId, newStatus) {
    const token = sessionStorage.getItem("token");
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/orders/admin/orders/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      const statusMap = {
        order_received: "Order Received", // NEW STATUS
        processing: "In Progress",
        shipped: "Ready for Pickup/Delivery",
        delivered: "Completed",
      };

      Swal.fire({
        title: "Success!",
        text: `Order #ORD${orderId.toString().padStart(3, "0")} marked as ${
          statusMap[newStatus] || newStatus
        }.`,
        icon: "success",
        confirmButtonColor: "#2c9045",
      });
      this.fetchOrders(); // Refresh the orders
    } catch (error) {
      console.error("Error updating status:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Failed to update status: ${error.message}`,
        confirmButtonColor: "#2c9045",
      });
    }
  }

  // Cancel order method
  async cancelOrder(orderId) {
    if (!confirm("Are you sure you want to cancel this order?")) {
      return;
    }

    const token = sessionStorage.getItem("token");
    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/orders/admin/orders/${orderId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      Swal.fire({
        title: "Cancelled",
        text: `Order #ORD${orderId
          .toString()
          .padStart(3, "0")} has been cancelled.`,
        confirmButtonColor: "#2c9045",
      });

      this.fetchOrders(); // Refresh the orders
    } catch (error) {
      console.error("Error cancelling order:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error submitting inquiry. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  }
}

// Instantiate the manager
const adminOrdersManager = new AdminOrdersManager();
