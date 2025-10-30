// Fetch custom cake and image-based orders from backend and populate table
async function fetchCustomCakeOrders() {
  try {
    const token = sessionStorage.getItem("token");

    const [customResponse, imageResponse] = await Promise.all([
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/image-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    let customData = { success: false, orders: [] };
    let imageData = { success: false, orders: [] };

    if (customResponse.ok) {
      customData = await customResponse.json();
    }

    if (imageResponse.ok) {
      imageData = await imageResponse.json();
    }

    const customTbody = document.querySelector(".cake-orders");
    const imageTbody = document.querySelector(".image-orders");
    customTbody.innerHTML = "";
    imageTbody.innerHTML = "";

    // Process custom cake orders (3D designs)
    if (customData.success && customData.orders) {
      customData.orders.forEach((order) => {
        const flavor = order.cakeColor === "#8B4513" ? "Chocolate" : "White";
        const icingStyle =
          order.icingStyle === "buttercream" ? "Buttercream" : "Whipped";
        const decorations =
          order.decorations === "flowers"
            ? `Flowers (${order.flowerType})`
            : order.decorations === "toppings"
            ? "Toppings"
            : order.decorations === "balloons"
            ? "Balloons"
            : "None";
        const customText =
          order.messageChoice === "custom" ? `"${order.customText}"` : "None";
        const details = `${flavor} cake, ${order.size}, ${icingStyle} icing, ${order.filling} filling, ${order.bottomBorder} bottom border, ${order.topBorder} top border, ${decorations}, ${customText}`;

        const displayOrderId = `CC${String(order.customCakeId).padStart(
          3,
          "0"
        )}`;
        const deliveryDate = order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString()
          : "Not set";
        const orderDate = order.orderDate
          ? new Date(order.orderDate).toLocaleDateString()
          : order.createdAt
          ? new Date(order.createdAt).toLocaleDateString()
          : "Unknown";

        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);

        // Format customer details with delivery address
        const customerDetails = `
  <div class="customer-info">
    <div class="customer-name fw-bold">${
      order.customer_name || (order.customer ? order.customer.name : "Unknown")
    }</div>
    <div class="customer-contact small text-muted">
      ${
        order.customer_email || (order.customer ? order.customer.email : "N/A")
      }<br>${order.customer_phone || "N/A"}
    </div>
    ${
      order.status === "Cancelled" && order.cancellation_remarks
        ? `
      <div class="cancellation-info small text-danger mt-1">
        <strong>Cancellation Reason:</strong> ${order.cancellation_remarks}
        ${
          order.cancelled_at
            ? `<br><small>Cancelled on: ${new Date(
                order.cancelled_at
              ).toLocaleDateString()}</small>`
            : ""
        }
      </div>
    `
        : ""
    }
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
  </div>
`;

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

        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${displayOrderId}</td>
      <td>${customerDetails}</td>
      <td>${details}</td>
      <td>${orderDate}</td>
      <td>${deliveryDate}</td>
      <td class="text-center">
        ${
          order.referenceImageUrl
            ? `<a href="#" class="view-image" data-image-url="${order.referenceImageUrl}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>`
            : "None"
        }
      </td>
      <td class="text-center">
        ${
          order.designImageUrl
            ? `<a href="#" class="view-image" data-image-url="${order.designImageUrl}" data-image-type="design" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>`
            : "None"
        }
      </td>
      <td>${renderStatusBadge(order.status)}</td>
      <td>${renderPriceInfo(order)}</td>
      <td>${paymentInfo}</td>
      <td>${updatedByInfo}</td> <!-- NEW COLUMN -->
      <td class="admin-actions-cell">
        ${renderStatusActions(order.customCakeId, false, order.status, order)}
      </td>
    `;
        customTbody.appendChild(row);
      });
    }

    // Process image-based orders
    if (imageData.success && imageData.orders) {
      imageData.orders.forEach((order) => {
        const orderId = order.imageBasedOrderId || order.id;
        const displayOrderId = `RCC${String(orderId).padStart(3, "0")}`;
        const deliveryDate = order.deliveryDate
          ? new Date(order.deliveryDate).toLocaleDateString()
          : "Not set";
        const orderDate = order.orderDate
          ? new Date(order.orderDate).toLocaleDateString()
          : order.createdAt
          ? new Date(order.createdAt).toLocaleDateString()
          : "Unknown";

        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);

        // Format customer details with delivery address
        const customerDetails = `
      <div class="customer-info">
        <div class="customer-name fw-bold">${
          order.customer_name ||
          (order.customer ? order.customer.name : "Unknown")
        }</div>
        <div class="customer-contact small text-muted">
          ${
            order.customer_email ||
            (order.customer ? order.customer.email : "N/A")
          }<br>${order.customer_phone || "N/A"}
        </div>
        ${
          order.status === "Cancelled" && order.cancellation_remarks
            ? `
          <div class="cancellation-info small text-danger mt-1">
            <strong>Cancellation Reason:</strong> ${order.cancellation_remarks}
            ${
              order.cancelled_at
                ? `<br><small>Cancelled on: ${new Date(
                    order.cancelled_at
                  ).toLocaleDateString()}</small>`
                : ""
            }
          </div>
        `
            : ""
        }
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
      </div>
    `;

        // Format updated by information for image orders
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

        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${displayOrderId}</td>
      <td>${customerDetails}</td>
      <td>${order.flavor}</td>
      <td>${order.size || "Not specified"}</td>
      <td>${order.message || "None"}</td>
      <td>${orderDate}</td>
      <td>${deliveryDate}</td> <!-- DELIVERY DATE (was eventDate) -->
      <td>${order.notes || "None"}</td>
      <td class="text-center">
        ${
          order.imagePath
            ? `<a href="#" class="view-image" data-image-url="${order.imagePath}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>`
            : "None"
        }
      </td>
      <td>${renderStatusBadge(order.status)}</td>
      <td>${renderPriceInfo(order)}</td>
      <td>${paymentInfo}</td>
      <td>${updatedByInfo}</td>
      <td class="admin-actions-cell">
        ${renderStatusActions(orderId, true, order.status, order)}
      </td>
    `;
        imageTbody.appendChild(row);
      });
    }
    if (!customData.orders || customData.orders.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="12" class="text-center">No custom cake orders found</td>`; // Changed from 11 to 12
      customTbody.appendChild(row);
    }

    if (!imageData.orders || imageData.orders.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="14" class="text-center">No image-based orders found</td>`; // Changed from 15 to 14 (removed eventDate column)
      imageTbody.appendChild(row);
    }

    setupEventListeners(token);
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

// Helper function to render price information
function renderPriceInfo(order) {
  if (!order.price) {
    return '<span class="status pending">Price Not Set</span>';
  }

  let html = `<div class="price-info">`;
  html += `<div class="fw-bold">₱${parseFloat(order.price).toFixed(2)}</div>`;

  const hasDownpaymentData =
    order.downpayment_amount !== null &&
    order.downpayment_amount !== undefined &&
    order.remaining_balance !== null &&
    order.remaining_balance !== undefined;

  if (hasDownpaymentData) {
    const downpaymentAmount = parseFloat(order.downpayment_amount) || 0;
    const remainingBalance = parseFloat(order.remaining_balance) || 0;

    html += `
      <small class="text-muted">
        <div>50% Down: ₱${downpaymentAmount.toFixed(2)}</div>
        <div>Balance: ₱${remainingBalance.toFixed(2)}</div>
      </small>`;
  }

  html += `</div>`;
  return html;
}

// Helper function to render payment info (FIXED: Completed orders show "paid")
function renderPaymentInfo(order) {
  // If status is completed, payment should be marked as paid
  if (order.status === "Completed") {
    return `<div class="payment-info-container">
      <span class="status paid">Paid</span>
    </div>`;
  }

  let html = `<div class="payment-info-container">`;

  // Downpayment status
  if (order.is_downpayment_paid === true) {
    const downpaymentAmount = parseFloat(order.downpayment_amount) || 0;
    const remainingBalance = parseFloat(order.remaining_balance) || 0;

    html += `
      <div class="downpayment-status mb-2">
        <span class="status paid">
          Downpayment Paid
        </span>
        <div class="mt-1">
          <small class="text-muted">
            Paid: ₱${downpaymentAmount.toFixed(2)}<br>
            Remaining: ₱${remainingBalance.toFixed(2)}
          </small>
        </div>
      </div>`;

    // Final payment status
    const finalPaymentBadge =
      order.final_payment_status === "paid"
        ? '<span class="status paid">Fully Paid</span>'
        : '<span class="status unpaid">Balance Due</span>';
    html += `<div>${finalPaymentBadge}</div>`;
  } else {
    // No downpayment yet
    const statusBadge =
      order.payment_status === "paid"
        ? '<span class="status paid">Paid</span>'
        : '<span class="status unpaid">Awaiting Payment</span>';
    html += `<div>${statusBadge}</div>`;
  }

  html += `</div>`;
  return html;
}

// Helper function to render status badge (UPDATED with admin-orders color scheme)
function renderStatusBadge(status) {
  const statusMap = {
    "Pending Review": { class: "pending", text: "Pending Review" },
    "Ready for Downpayment": {
      class: "ready-for-dp",
      text: "Ready for Downpayment",
    },
    "Downpayment Paid": { class: "dp-paid", text: "Downpayment Paid" },
    "In Progress": { class: "in-progress", text: "In Progress" },
    "Ready for Pickup/Delivery": {
      class: "ready",
      text: "Ready for Pickup/Delivery",
    },
    Completed: { class: "delivered", text: "Completed" },
    Cancelled: { class: "cancelled", text: "Cancelled" },
    "Not Feasible": { class: "cancelled", text: "Not Feasible" },
  };

  const config = statusMap[status] || { class: "pending", text: status };
  return `<span class="status ${config.class}">${config.text}</span>`;
}

async function cancelOrderWithRemarks(orderId, isImageOrder, remarks) {
  const token = sessionStorage.getItem("token");
  const endpoint = isImageOrder
    ? `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}/cancel`
    : `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}/cancel`;

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        cancellation_remarks: remarks,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.message || `HTTP error! Status: ${response.status}`
      );
    }

    return {
      success: true,
      data: result,
      message: result.message || "Order cancelled successfully",
    };
  } catch (error) {
    console.error("Error cancelling order:", error);
    return {
      success: false,
      error: error.message,
      message: "Error cancelling order. Please try again.",
    };
  }
}

// Helper function to render status actions
function renderStatusActions(orderId, isImageOrder, currentStatus, order) {
  let html = '<div class="admin-actions">';

  if (isImageOrder) {
    html += renderImageOrderActions(orderId, currentStatus, order);
  } else {
    html += renderCustomCakeActions(orderId, currentStatus, order);
  }

  // Cancel button for active orders - FIXED: Added data-is-image-order attribute
  if (
    currentStatus !== "Cancelled" &&
    currentStatus !== "Completed" &&
    currentStatus !== "Not Feasible"
  ) {
    html += `<button class="btn btn-outline-danger btn-sm cancel-order-btn mt-2" 
            data-order-id="${orderId}" 
            data-is-image-order="${isImageOrder}">
      Cancel Order
    </button>`;
  }

  html += "</div>";
  return html;
}
// Image-based order actions
function renderImageOrderActions(orderId, currentStatus, order) {
  let html = "";
  const showPriceInput = [
    "Pending Review",
    "Feasible",
    "Ready for Downpayment",
  ].includes(currentStatus);
  const priceIsSet = order.price && order.price > 0;

  // Price input for relevant statuses - DISABLED once price is set
  if (showPriceInput && currentStatus !== "Not Feasible") {
    const isDisabled = priceIsSet ? "disabled" : "";
    const disabledText = priceIsSet ? " (Price locked)" : "";

    html += `
      <div class="price-input mb-2">
        <label class="form-label small">Total Price:${disabledText}</label>
        <input 
          type="number" 
          class="form-control form-control-sm price-input-field" 
          placeholder="Enter total price" 
          value="${order.price || ""}" 
          step="0.01" 
          min="0"
          ${isDisabled}
        >
        ${
          order.price
            ? `
          <small class="text-muted d-block mt-1">
            <i class="fas fa-info-circle"></i> 50% = ₱${(
              order.price * 0.5
            ).toFixed(2)}
          </small>
        `
            : ""
        }
        ${
          priceIsSet
            ? `
        `
            : ""
        }
      </div>`;
  }

  // Action buttons based on current status - REMOVED downpayment-paid button
  switch (currentStatus) {
    case "Pending Review":
      html += `
        <button class="btn btn-success btn-sm mark-feasible mb-2" 
                data-order-id="${orderId}" 
                data-is-image-order="true">
          Mark as Feasible
        </button>
        <button class="btn btn-danger btn-sm mark-not-feasible w-100" 
                data-order-id="${orderId}" 
                data-is-image-order="true">
          Not Feasible
        </button>`;
      break;

    case "Feasible":
      if (order.price) {
        html += `
          <button class="btn btn-primary btn-sm ready-downpayment w-100" 
                  data-order-id="${orderId}" 
                  data-is-image-order="true">
            Ready for Downpayment
          </button>`;
      } else {
        html += `<small class="text-warning d-block mb-1"><i class="fas fa-exclamation-triangle"></i> Set price first</small>`;
      }
      break;

    case "Ready for Downpayment":
      // REMOVED: Downpayment Paid button - this should only be updated via customer payment
      html += `
        <div class="text-center">
          <small class="text-muted d-block">
            <i class="fas fa-info-circle"></i> Waiting for customer to pay downpayment
          </small>
        </div>`;
      break;

    case "Downpayment Paid":
      html += `
        <button class="btn btn-primary btn-sm mark-in-progress w-100" 
                data-order-id="${orderId}" 
                data-is-image-order="true">
          Mark In Progress
        </button>`;
      break;

    case "In Progress":
      html += `
        <button class="btn btn-primary btn-sm ready-pickup w-100" 
                data-order-id="${orderId}" 
                data-is-image-order="true">
          Ready for Pickup/Delivery
        </button>`;
      break;

    case "Ready for Pickup/Delivery":
      html += `
        <button class="btn btn-primary btn-sm mark-completed w-100" 
                data-order-id="${orderId}" 
                data-is-image-order="true">
          Mark Completed
        </button>`;
      break;

    case "Not Feasible":
    case "Cancelled":
    case "Completed":
      html += `<span class="text-muted small">No further actions</span>`;
      break;
  }

  return html;
}

// 3D Custom Cake actions
function renderCustomCakeActions(orderId, currentStatus, order) {
  let html = "";
  const showPriceInput = ["Pending Review", "Ready for Downpayment"].includes(
    currentStatus
  );

  // Price input for Ready for Downpayment status
  if (showPriceInput && currentStatus !== "Pending Review") {
    html += `
      <div class="price-input mb-2">
        <label class="form-label small">Total Price:</label>
        <input 
          type="number" 
          class="form-control form-control-sm price-input-field" 
          placeholder="Enter total price" 
          value="${order.price || ""}" 
          step="0.01" 
          min="0"
        >
        ${
          order.price
            ? `
          <small class="text-muted d-block mt-1">
            <i class="fas fa-info-circle"></i> 50% = ₱${(
              order.price * 0.5
            ).toFixed(2)}
          </small>
        `
            : ""
        }
      </div>`;
  }

  // Action buttons based on current status
  switch (currentStatus) {
    case "Pending Review":
      html += `<span class="text-muted small">Pending admin review</span>`;
      break;

    case "Ready for Downpayment":
      html += `
        <button class="btn btn-primary btn-sm downpayment-paid w-100" data-order-id="${orderId}" data-is-image-order="false">
          Mark: Downpayment Paid
        </button>`;
      break;

    case "Downpayment Paid":
      html += `
        <button class="btn btn-primary btn-sm mark-in-progress w-100" data-order-id="${orderId}" data-is-image-order="false">
          Mark In Progress
        </button>`;
      break;

    case "In Progress":
      html += `
        <button class="btn btn-primary btn-sm ready-pickup w-100" data-order-id="${orderId}" data-is-image-order="false">
          Ready for Pickup/Delivery
        </button>`;
      break;

    case "Ready for Pickup/Delivery":
      html += `
        <button class="btn btn-primary btn-sm mark-completed w-100" data-order-id="${orderId}" data-is-image-order="false">
          Mark Completed
        </button>`;
      break;

    case "Cancelled":
    case "Completed":
      html += `<span class="text-muted small">No further actions</span>`;
      break;

    default:
      html += `<span class="text-muted small">${currentStatus}</span>`;
      break;
  }

  return html;
}
// Setup event listeners
function setupEventListeners(token) {
  // Remove existing event listeners first to prevent duplicates
  document.removeEventListener("click", handleStatusActions);

  // Image modal handler
  document.querySelectorAll(".view-image").forEach((link) => {
    link.removeEventListener("click", handleImageClick);
    link.addEventListener("click", handleImageClick);
  });

  // Add the main status actions handler
  document.addEventListener("click", handleStatusActions);

  // Real-time price calculation preview
  document.querySelectorAll(".price-input-field").forEach((input) => {
    input.removeEventListener("input", handlePriceInput);
    input.addEventListener("input", handlePriceInput);
  });
}

// Separate handler functions to allow proper removal
function handleImageClick(e) {
  e.preventDefault();
  const modalImage = document.querySelector("#imageModal img");
  const modalTitle = document.querySelector("#imageModal .modal-title");
  const imageType = this.dataset.imageType;

  modalImage.src = this.dataset.imageUrl;
  modalTitle.textContent =
    imageType === "design" ? "3D Design Image" : "Reference Image";
}

function handlePriceInput() {
  const price = parseFloat(this.value);
  const row = this.closest("tr");
  const existingPreview = row.querySelector(".downpayment-preview");

  if (existingPreview) {
    existingPreview.remove();
  }

  if (price && !isNaN(price) && price > 0) {
    const preview = document.createElement("small");
    preview.className = "text-muted d-block mt-1 downpayment-preview";
    preview.innerHTML = `<i class="fas fa-info-circle"></i> 50% Downpayment = ₱${(
      price * 0.5
    ).toFixed(2)}`;
    this.parentElement.appendChild(preview);
  }
}

// Main status actions handler
async function handleStatusActions(e) {
  const target = e.target.closest("button");
  if (!target) return;

  const token = sessionStorage.getItem("token");
  const orderId = target.dataset.orderId;
  const isImageOrder = target.dataset.isImageOrder === "true" || false;

  // Only proceed if it's one of our action buttons
  if (
    !target.classList.contains("mark-feasible") &&
    !target.classList.contains("mark-not-feasible") &&
    !target.classList.contains("ready-downpayment") &&
    !target.classList.contains("downpayment-paid") &&
    !target.classList.contains("mark-in-progress") &&
    !target.classList.contains("ready-pickup") &&
    !target.classList.contains("mark-completed") &&
    !target.classList.contains("cancel-order-btn")
  ) {
    return;
  }

  try {
    let endpoint, body, newStatus;
    const row = target.closest("tr");
    const priceInput = row?.querySelector(".price-input-field");
    const price = priceInput ? parseFloat(priceInput.value) : null;

    // Handle different button types
    if (target.classList.contains("mark-feasible")) {
      if (!price || isNaN(price) || price <= 0) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Please enter a valid price before marking as feasible.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }
      endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}/price`;
      newStatus = "Feasible";
      body = {
        price: price,
        status: newStatus,
        downpayment_amount: price * 0.5,
        remaining_balance: price * 0.5,
      };
    } else if (target.classList.contains("mark-not-feasible")) {
      endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      newStatus = "Not Feasible";
      body = { status: newStatus };
    } else if (target.classList.contains("ready-downpayment")) {
      endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      newStatus = "Ready for Downpayment";
      body = { status: newStatus };
    } else if (target.classList.contains("downpayment-paid")) {
      if (isImageOrder) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      } else {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
      }
      newStatus = "Downpayment Paid";
      body = { status: newStatus };
    } else if (target.classList.contains("mark-in-progress")) {
      if (isImageOrder) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      } else {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
      }
      newStatus = "In Progress";
      body = { status: newStatus };
    } else if (target.classList.contains("ready-pickup")) {
      if (isImageOrder) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      } else {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
      }
      newStatus = "Ready for Pickup/Delivery";
      body = { status: newStatus };
    } else if (target.classList.contains("mark-completed")) {
      if (isImageOrder) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}`;
      } else {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
      }
      newStatus = "Completed";
      body = { status: newStatus };
    } else if (target.classList.contains("cancel-order-btn")) {
      // NEW: Handle cancellation with remarks modal
      const row = target.closest("tr");
      const orderDetails = {
        customer_name:
          row.cells[1].querySelector(".customer-name")?.textContent ||
          "Unknown Customer",
        order_type: isImageOrder ? "Image-based" : "3D Custom Cake",
      };
      openCancellationModal(orderId, isImageOrder, orderDetails);
      return; // Don't proceed with regular fetch
    }

    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.success) {
      showNotification("success", `Order ${orderId} updated to ${newStatus}!`);
      fetchCustomCakeOrders();
    } else {
      const errorMsg =
        data.message ||
        `Server returned ${response.status}: ${response.statusText}`;
      throw new Error(errorMsg);
    }
  } catch (error) {
    console.error("Error updating order:", error);
    showNotification("error", `Failed to update order: ${error.message}`);
  }
}

// Cancellation Modal Functions - Add to admin-cake.js

let cancellationModal = null;

// Initialize cancellation modal
function initializeCancellationModal() {
  cancellationModal = new bootstrap.Modal(
    document.getElementById("cancellationModal")
  );

  // Confirm cancellation button
  document
    .getElementById("confirmCancelBtn")
    .addEventListener("click", confirmCancellation);

  // Reset form when modal is hidden
  document
    .getElementById("cancellationModal")
    .addEventListener("hidden.bs.modal", resetCancellationForm);

  // Real-time validation
  document
    .getElementById("cancellationRemarks")
    .addEventListener("input", validateCancellationRemarks);
}

// Open cancellation modal
function openCancellationModal(orderId, isImageOrder, orderDetails = {}) {
  document.getElementById("cancelOrderId").value = orderId;
  document.getElementById("cancelOrderType").value = isImageOrder
    ? "image"
    : "custom";

  // Update modal title with order details
  const modalTitle = document.getElementById("cancellationModalLabel");
  const displayOrderId = isImageOrder
    ? `RCC${String(orderId).padStart(3, "0")}`
    : `CC${String(orderId).padStart(3, "0")}`;

  modalTitle.textContent = `Cancel ${orderDetails.order_type} Order #${displayOrderId}`;

  // Add customer info to modal body if available
  const customerInfo = document.createElement("div");
  customerInfo.className = "alert alert-info";
  customerInfo.innerHTML = `
    <strong>Customer:</strong> ${orderDetails.customer_name}<br>
    <strong>Order Type:</strong> ${orderDetails.order_type}
  `;

  const form = document.getElementById("cancellationForm");
  const existingAlert = form.querySelector(".alert");
  if (existingAlert) {
    existingAlert.remove();
  }
  form.insertBefore(customerInfo, form.firstChild);

  cancellationModal.show();
}

// Confirm and process cancellation
async function confirmCancellation() {
  const orderId = document.getElementById("cancelOrderId").value;
  const isImageOrder =
    document.getElementById("cancelOrderType").value === "image";
  const remarks = document.getElementById("cancellationRemarks").value.trim();

  // Validate remarks
  if (!validateCancellationRemarks()) {
    return;
  }

  // Disable button and show loading
  const confirmBtn = document.getElementById("confirmCancelBtn");
  const originalText = confirmBtn.innerHTML;
  confirmBtn.disabled = true;
  confirmBtn.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cancelling...';

  try {
    const result = await cancelOrderWithRemarks(orderId, isImageOrder, remarks);

    if (result.success) {
      cancellationModal.hide();
      showNotification(
        "success",
        result.message || "Order cancelled successfully"
      );

      // Refresh the orders table
      fetchCustomCakeOrders();
    } else {
      showNotification("error", result.message || "Failed to cancel order");
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = originalText;
    }
  } catch (error) {
    console.error("Cancellation error:", error);
    showNotification("error", "Error cancelling order. Please try again.");
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = originalText;
  }
}

// Validate cancellation remarks
function validateCancellationRemarks() {
  const textarea = document.getElementById("cancellationRemarks");
  const remarks = textarea.value.trim();

  if (!remarks) {
    textarea.classList.add("is-invalid");
    return false;
  } else {
    textarea.classList.remove("is-invalid");
    return true;
  }
}

// Reset cancellation form
function resetCancellationForm() {
  document.getElementById("cancellationForm").reset();
  document.getElementById("cancellationRemarks").classList.remove("is-invalid");

  const confirmBtn = document.getElementById("confirmCancelBtn");
  confirmBtn.disabled = false;
  confirmBtn.innerHTML = "Confirm Cancellation";

  // Remove customer info alert
  const form = document.getElementById("cancellationForm");
  const alert = form.querySelector(".alert");
  if (alert) {
    alert.remove();
  }
}

// Notification helper function
function showNotification(type, message) {
  const alertClass = type === "success" ? "alert-success" : "alert-danger";
  const icon = type === "success" ? "fa-check-circle" : "fa-exclamation-circle";

  const notification = document.createElement("div");
  notification.className = `alert ${alertClass} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  notification.style.zIndex = "9999";
  notification.innerHTML = `
    <i class="fas ${icon}"></i> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Search functionality
document.querySelector(".search-bar")?.addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();

  const activeTab = document.querySelector(".tab-pane.active");
  if (activeTab) {
    const tbody = activeTab.querySelector("tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((row) => {
        const orderId = row.cells[0].textContent.toLowerCase();
        const customerName = row.cells[1].textContent.toLowerCase();
        row.style.display =
          orderId.includes(searchTerm) || customerName.includes(searchTerm)
            ? ""
            : "none";
      });
    }
  }
});

// Filter functionality
document.getElementById("filterForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const selectedStatus = document
    .getElementById("filterStatus")
    .value.trim()
    .toLowerCase();

  const activeTab = document.querySelector(".tab-pane.active");
  if (activeTab) {
    const tbody = activeTab.querySelector("tbody");
    if (tbody) {
      tbody.querySelectorAll("tr").forEach((row) => {
        const statusBadge = row.querySelector(".status");
        const rowStatus = statusBadge
          ? statusBadge.textContent.trim().toLowerCase()
          : "";
        row.style.display =
          selectedStatus === "" || rowStatus.includes(selectedStatus)
            ? ""
            : "none";
      });
    }
  }

  // Close modal after applying filter
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("filterModal")
  );
  if (modal) modal.hide();
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  fetchCustomCakeOrders();
  initializeCancellationModal();

  // Refresh data when tab is shown
  const tabEls = document.querySelectorAll('a[data-bs-toggle="tab"]');
  tabEls.forEach((tabEl) => {
    tabEl.addEventListener("shown.bs.tab", () => {
      fetchCustomCakeOrders();
    });
  });
});
