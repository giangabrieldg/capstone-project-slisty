// custom-orders.js - Enhanced customer orders script with downpayment UI indicators
const apiService = new CakeAPIService();
let allOrders = { custom: [], image: [] };

async function fetchCustomOrders() {
  try {
    const response = await apiService.getCustomOrders();
    if (response.success) {
      allOrders = {
        custom: response.data.customOrders || [],
        image: response.data.imageOrders || [],
      };
      populateOrdersTable(allOrders.custom, allOrders.image);
      updateOrderCount();
    } else {
      alert(response.message || "Failed to load orders. Please try again.");
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Failed to load orders. Please try again.",
      confirmButtonColor: "#2c9045",
    });
  }
}

function updateOrderCount() {
  document.getElementById("orderCount").textContent =
    allOrders.custom.length + allOrders.image.length;
}

function applyFilters() {
  const searchTerm = document.getElementById("searchBar").value.toLowerCase();
  const statusFilter = document.getElementById("filterStatus").value;
  const paymentFilter = document.getElementById("filterPaymentStatus").value;

  const matchPayment = (order) => {
    const paymentStatus = getPaymentStatus(order);

    // Handle "Downpayment Paid" filter explicitly
    if (paymentFilter === "Downpayment Paid") {
      return (
        order.is_downpayment_paid === true &&
        order.final_payment_status !== "paid"
      );
    }

    return !paymentFilter || paymentStatus === paymentFilter;
  };

  const filterOrders = (orders, isImageOrder = false) =>
    orders.filter((order) => {
      const orderId = `${isImageOrder ? "RCC" : "CC"}${String(
        isImageOrder ? order.imageBasedOrderId : order.customCakeId
      ).padStart(3, "0")}`.toLowerCase();
      const customerName = (
        order.customer_name ||
        order.customer?.name ||
        "Unknown"
      ).toLowerCase();

      const statusMatch = !statusFilter || order.status === statusFilter;
      const paymentMatch = matchPayment(order);
      const searchMatch =
        orderId.includes(searchTerm) || customerName.includes(searchTerm);

      return statusMatch && paymentMatch && searchMatch;
    });

  const customFiltered = filterOrders(allOrders.custom);
  const imageFiltered = filterOrders(allOrders.image, true);

  populateOrdersTable(customFiltered, imageFiltered);
}

function getPaymentStatus(order) {
  if (order.status === "Completed") return "Paid";
  if (order.is_downpayment_paid === true) {
    return order.final_payment_status === "paid" ? "Paid" : "Balance Due";
  }
  return order.payment_status === "paid" ? "Paid" : "Awaiting Payment";
}

function populateOrdersTable(customOrders, imageOrders) {
  const tableBody = document.getElementById("ordersTableBody");
  tableBody.innerHTML = "";

  // Custom Cake Orders (3D)
  customOrders.forEach((order) => {
    const displayOrderId = `CC${String(order.customCakeId).padStart(3, "0")}`;
    const flavor = getFlavorName(order.cakeColor);
    const details = `Size: ${order.size}, Flavor: ${flavor}, Icing: ${order.icingStyle}`;
    const imageUrl = order.designImageUrl || order.referenceImageUrl || "";
    const deliveryDate = order.deliveryDate
      ? new Date(order.deliveryDate).toLocaleDateString()
      : "Not set";
    const orderDate = order.orderDate
      ? new Date(order.orderDate).toLocaleDateString()
      : order.createdAt
      ? new Date(order.createdAt).toLocaleDateString()
      : "Unknown";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="order-id">${displayOrderId}</span></td>
      <td><span class="order-type-badge order-type-3d">3D Custom</span></td>
      <td><strong>${
        order.customer_name || order.customer?.name || "Unknown"
      }</strong></td>
      <td>${orderDate}</td>
      <td><span class="delivery-date">${deliveryDate}</span></td>
      <td><div class="order-details">${details}</div></td>
      <td>${renderStatusBadge(order.status)}</td>
      <td>
        ${
          imageUrl
            ? `<button class="btn btn-sm btn-link" onclick="viewImage('${imageUrl}')"><i class="fas fa-image"></i> View</button>`
            : '<span class="text-muted small">No Image</span>'
        }
      </td>
      <td>${renderPriceDisplay(order)}</td>
      <td>${renderPaymentDisplay(order)}</td>
      <td>${renderActionButtons(order, false)}</td>
    `;
    tableBody.appendChild(row);
  });

  // Image-Based Orders
  imageOrders.forEach((order) => {
    const displayOrderId = `RCC${String(order.imageBasedOrderId).padStart(
      3,
      "0"
    )}`;
    const details = `Flavor: ${order.flavor}, Size: ${
      order.size || "Not specified"
    }, Event: ${new Date(order.eventDate).toLocaleDateString()}`;
    const deliveryDate = order.deliveryDate
      ? new Date(order.deliveryDate).toLocaleDateString()
      : "Not set";
    const orderDate = order.orderDate
      ? new Date(order.orderDate).toLocaleDateString()
      : order.createdAt
      ? new Date(order.createdAt).toLocaleDateString()
      : "Unknown";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><span class="order-id">${displayOrderId}</span></td>
      <td><span class="order-type-badge order-type-image">Image-Based</span></td>
      <td><strong>${
        order.customer_name || order.customer?.name || "Unknown"
      }</strong></td>
      <td>${orderDate}</td>
      <td><span class="delivery-date">${deliveryDate}</span></td>
      <td><div class="order-details">${details}</div></td>
      <td>${renderStatusBadge(order.status)}</td>
      <td>
        ${
          order.imagePath
            ? `<button class="btn btn-sm btn-link" onclick="viewImage('${order.imagePath}')"><i class="fas fa-image"></i> View</button>`
            : '<span class="text-muted small">No Image</span>'
        }
      </td>
      <td>${renderPriceDisplay(order)}</td>
      <td>${renderPaymentDisplay(order)}</td>
      <td>${renderActionButtons(order, true)}</td>
    `;
    tableBody.appendChild(row);
  });

  // Show empty state if no orders
  if (customOrders.length === 0 && imageOrders.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td colspan="11" class="text-center py-4">
        <div class="empty-state">
          <div class="icon">🎂</div>
          <h4>No Custom Orders Yet</h4>
          <p>Start by creating a custom cake order!</p>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  }
}

// Enhanced status badge rendering - matching admin-cake colors
function renderStatusBadge(status) {
  const statusMap = {
    "Pending Review": { class: "pending", text: "Pending Review" },
    "Ready for Downpayment": {
      class: "ready-for-dp",
      text: "Ready for Downpayment",
    },
    "Downpayment Paid": { class: "dp-paid", text: "Downpayment Paid" },
    "In Progress": { class: "in-progress", text: "In Progress" },
    "Ready for Pickup/Delivery": { class: "ready", text: "Ready" },
    Completed: { class: "delivered", text: "Completed" },
    Cancelled: { class: "cancelled", text: "Cancelled" },
    Feasible: { class: "in-progress", text: "Feasible" },
    "Not Feasible": { class: "cancelled", text: "Not Feasible" },
  };

  const config = statusMap[status] || { class: "pending", text: status };
  return `<span class="status ${config.class}">${config.text}</span>`;
}

function renderPriceDisplay(order) {
  if (!order.price) {
    return '<span class="price-tbd">TBD</span>';
  }

  let html = `<div class="price-container">`;
  html += `<div class="total-price">₱${parseFloat(order.price).toFixed(
    2
  )}</div>`;

  const hasDownpaymentData =
    order.downpayment_amount !== null &&
    order.downpayment_amount !== undefined &&
    order.remaining_balance !== null &&
    order.remaining_balance !== undefined;

  if (hasDownpaymentData) {
    const downpaymentAmount = parseFloat(order.downpayment_amount) || 0;
    const remainingBalance = parseFloat(order.remaining_balance) || 0;

    html += `
      <div class="price-breakdown">
        <small class="text-muted">
          50% Down: ₱${downpaymentAmount.toFixed(2)}<br>
          Balance: ₱${remainingBalance.toFixed(2)}
        </small>
      </div>`;
  }

  html += `</div>`;
  return html;
}

function renderPaymentDisplay(order) {
  // If completed, show as paid
  if (order.status === "Completed") {
    return '<span class="status paid"> Paid</span>';
  }

  let html = `<div class="payment-display">`;

  const paymentMethod =
    order.payment_status === "paid"
      ? "GCash"
      : order.payment_status === "pending"
      ? "Cash"
      : "Not set";

  if (order.is_downpayment_paid === true) {
    const finalPaid = order.final_payment_status === "paid";
    const downpaymentAmount = parseFloat(order.downpayment_amount) || 0;
    const remainingBalance = parseFloat(order.remaining_balance) || 0;

    html += `<div class="mt-2">
      <small class="text-muted d-block">Downpayment: ₱${downpaymentAmount.toFixed(
        2
      )}</small>
      <small class="text-muted d-block">Balance: ₱${remainingBalance.toFixed(
        2
      )}</small>
      <span class="badge ${
        finalPaid ? "bg-success" : "bg-warning text-dark"
      } mt-1">
        ${finalPaid ? "Fully Paid" : "Balance Due"}
      </span>
    </div>`;
  } else {
    html +=
      order.payment_status === "paid"
        ? '<div class="mt-2"><span class="badge bg-success">Paid</span></div>'
        : '<div class="mt-2"><span class="badge bg-secondary"><i class="fas fa-clock"></i> Awaiting</span></div>';
  }

  html += `</div>`;
  return html;
}

function renderActionButtons(order, isImageOrder) {
  const orderId = isImageOrder ? order.imageBasedOrderId : order.customCakeId;

  if (isImageOrder) {
    if (order.status === "Not Feasible" || order.status === "Cancelled") {
      return `<span class="text-muted small">${order.status}</span>`;
    }

    if (
      (order.status === "Feasible" ||
        order.status === "Ready for Downpayment") &&
      order.price &&
      order.is_downpayment_paid !== true
    ) {
      const downpaymentAmount = order.downpayment_amount || order.price * 0.5;
      return `
        <button class="btn btn-sm btn-primary" onclick="checkoutOrder(${orderId}, true)">
        Pay Downpayment
        </button>`;
    }

    if (
      order.is_downpayment_paid === true &&
      order.final_payment_status !== "paid"
    ) {
      return `<span class="text-muted small">Balance Due at Pickup</span>`;
    }

    if (order.final_payment_status === "paid") {
      return `<span class="badge bg-success"> Fully Paid</span>`;
    }

    return `<span class="text-muted small">${order.status}</span>`;
  } else {
    if (order.status === "Cancelled") {
      return `<span class="text-muted small">Cancelled</span>`;
    }

    if (
      order.status === "Ready for Downpayment" &&
      order.price &&
      order.is_downpayment_paid !== true
    ) {
      const downpaymentAmount = order.downpayment_amount || order.price * 0.5;
      return `
        <button class="btn btn-sm btn-primary" onclick="checkoutOrder(${orderId}, false)">
          Pay Downpayment
        </button>`;
    }

    if (
      order.is_downpayment_paid === true &&
      order.final_payment_status !== "paid"
    ) {
      return `<span class="text-muted small">Balance Due at Pickup</span>`;
    }

    if (order.final_payment_status === "paid") {
      return `<span class="badge bg-success"> Fully Paid</span>`;
    }

    return `<span class="text-muted small">${order.status}</span>`;
  }
}

function getFlavorName(cakeColor) {
  const flavors = {
    "#8B4513": "Chocolate",
    "#FFFFFF": "White",
    "#FFD700": "Vanilla",
    "#FF69B4": "Strawberry",
  };
  return flavors[cakeColor] || "Custom";
}

async function checkoutOrder(orderId, isImageOrder) {
  try {
    const orderDetails = await apiService.getOrderDetails(
      orderId,
      isImageOrder
    );
    if (!orderDetails.success) {
      throw new Error("Could not retrieve order details");
    }

    const order = orderDetails.data.order;
    let paymentAmount, isDownpayment;

    const validDownpaymentStatuses = isImageOrder
      ? ["Feasible", "Ready for Downpayment"]
      : ["Ready for Downpayment"];

    if (order.is_downpayment_paid === true) {
      Swal.fire({
        title: "Success!",
        text: "Downpayment already paid. The remaining balance will be collected upon pickup/delivery.",
        icon: "success",
        confirmButtonColor: "#2c9045",
      });
      return;
    } else if (validDownpaymentStatuses.includes(order.status)) {
      paymentAmount = order.downpayment_amount || order.price * 0.5;
      isDownpayment = true;
    } else {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `This order is not ready for payment. Current status: ${order.status}`,
        confirmButtonColor: "#2c9045",
      });

      return;
    }

    const checkoutUrl = `/customer/checkout.html?customCakeId=${orderId}&isImageOrder=${isImageOrder}&amount=${paymentAmount}&isDownpayment=${isDownpayment}`;
    window.location.href = checkoutUrl;
  } catch (error) {
    console.error("Error during checkout:", error);
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Failed to proceed to checkout. Please try again.`",
      confirmButtonColor: "#2c9045",
    });
  }
}

function viewImage(imageUrl) {
  const modalImage = document.getElementById("modalImage");
  modalImage.src = imageUrl;
  const modal = new bootstrap.Modal(document.getElementById("imageModal"));
  modal.show();
}

// Event listeners
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchBar").addEventListener("input", applyFilters);
  document
    .getElementById("filterStatus")
    .addEventListener("change", applyFilters);
  document
    .getElementById("filterPaymentStatus")
    .addEventListener("change", applyFilters);
  document
    .getElementById("applyFilterBtn")
    .addEventListener("click", applyFilters);

  // Load ALL orders on page load
  fetchCustomOrders();
});
