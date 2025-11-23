let currentSummaryData = null;

//date formatting for API
function formatDateForAPI(dateString) {
  const date = new Date(dateString);

  // Convert to Manila time (UTC+8)
  const manilaOffset = 8 * 60;
  const localOffset = date.getTimezoneOffset();
  const manilaTime = new Date(
    date.getTime() + (manilaOffset + localOffset) * 60000
  );

  const year = manilaTime.getFullYear();
  const month = String(manilaTime.getMonth() + 1).padStart(2, "0");
  const day = String(manilaTime.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Initialize charts
const totalOrdersCtx = document
  .getElementById("totalOrdersChart")
  .getContext("2d");
const totalOrdersChart = new Chart(totalOrdersCtx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Regular Orders",
        data: [],
        borderColor: "rgba(44, 144, 69, 1)",
        backgroundColor: "rgba(44, 144, 69, 0.2)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Custom Cake Orders",
        data: [],
        borderColor: "rgba(255, 215, 0, 1)",
        backgroundColor: "rgba(255, 215, 0, 0.2)",
        tension: 0.4,
        fill: true,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
    },
    plugins: {
      legend: {
        position: "top",
      },
    },
  },
});

const popularItemsCtx = document
  .getElementById("popularItemsChart")
  .getContext("2d");
const popularItemsChart = new Chart(popularItemsCtx, {
  type: "bar",
  data: {
    labels: [],
    datasets: [
      {
        label: "Quantity Sold",
        data: [],
        backgroundColor: "rgba(44, 144, 69, 0.8)",
        borderColor: "rgba(44, 144, 69, 1)",
        borderWidth: 1,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    scales: {
      x: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
      y: {
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
      },
    },
    plugins: {
      legend: {
        position: "top",
      },
    },
  },
});

// Loading state management
let isLoading = false;

function setLoadingState(loading) {
  isLoading = loading;
  const loader = document.getElementById("loadingOverlay");
  if (loader) {
    loader.style.display = loading ? "flex" : "none";
  }

  // Disable buttons during loading
  document.getElementById("exportExcel").disabled = loading;
  document.getElementById("applyDateFilter").disabled = loading;
}

// Main function to fetch and update reports
async function updateReports(startDate, endDate) {
  if (isLoading) return;

  setLoadingState(true);
  try {
    const token = sessionStorage.getItem("token");
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    // Format dates for ALL API calls
    const formattedStartDate = formatDateForAPI(startDate);
    const formattedEndDate = formatDateForAPI(endDate);

    // Fetch data from all endpoints in parallel
    const [reportsResponse, customCakeData, imageBasedData] = await Promise.all(
      [
        fetch(
          `${window.API_BASE_URL}/api/orders/admin/reports?start_date=${formattedStartDate}&end_date=${formattedEndDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        ),
        fetch(
          `${window.API_BASE_URL}/api/custom-cake/admin/orders?start_date=${formattedStartDate}&end_date=${formattedEndDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        ),
        fetch(
          `${window.API_BASE_URL}/api/custom-cake/admin/image-orders?start_date=${formattedStartDate}&end_date=${formattedEndDate}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        ),
      ]
    );

    if (!reportsResponse.ok) {
      if (reportsResponse.status === 401 || reportsResponse.status === 403) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`Server returned ${reportsResponse.status}`);
    }

    const data = await reportsResponse.json();
    const customCakeOrders = customCakeData.ok
      ? (await customCakeData.json()).orders || []
      : [];
    const imageBasedOrders = imageBasedData.ok
      ? (await imageBasedData.json()).orders || []
      : [];

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch reports");
    }

    // DEBUG: Check the structure of regular orders
    console.log("Regular orders data:", data.orders);
    if (data.orders && data.orders.length > 0) {
      console.log("First regular order structure:", data.orders[0]);
    }

    // Filter out cancelled orders for charts and summary
    const activeCustomCakeOrders = customCakeOrders.filter(
      (order) => order.status !== "Cancelled" && order.status !== "Not Feasible"
    );

    const activeImageBasedOrders = imageBasedOrders.filter(
      (order) => order.status !== "Cancelled" && order.status !== "Not Feasible"
    );

    // Format regular orders with proper customer info
    const formattedRegularOrders = data.orders.map((order) => ({
      ...order,
      order_type: "regular",
      // Ensure customer info is properly mapped
      customer_name: order.customer_name || order.customer?.name || "Unknown",
      customer_email:
        order.customer_email || order.customer?.email || "No email",
      customer_phone:
        order.customer_phone || order.customer?.phone || "No phone",
    }));

    // Combine all orders: regular orders + custom cake orders
    const allOrders = [
      ...formattedRegularOrders,
      ...formatCustomCakeOrdersForReports(customCakeOrders, "CC"),
      ...formatCustomCakeOrdersForReports(imageBasedOrders, "RCC"),
    ];

    // Sort all orders by date (newest first)
    allOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    // Update summary to include ACTIVE custom cakes only (exclude cancelled)
    const updatedSummary = {
      ...data.summary,
      total_custom_cakes:
        activeCustomCakeOrders.length + activeImageBasedOrders.length,
      custom_cake_3d_orders: activeCustomCakeOrders.length,
      custom_cake_image_orders: activeImageBasedOrders.length,
      total_orders:
        (data.summary.total_orders || 0) +
        activeCustomCakeOrders.length +
        activeImageBasedOrders.length,
      total_revenue:
        (parseFloat(data.summary.total_revenue) || 0) +
        calculateCustomCakeRevenue(activeCustomCakeOrders) +
        calculateCustomCakeRevenue(activeImageBasedOrders),
    };

    // Update all components
    updateSummaryCards(updatedSummary);
    updateSalesTable(allOrders);
    updateCharts(
      data.daily_orders,
      data.popular_items,
      customCakeOrders,
      imageBasedOrders
    );
  } catch (error) {
    console.error("Error fetching reports:", error);
    showError("Failed to load reports. Please try again.");
  } finally {
    setLoadingState(false);
  }
}

// Format custom cake orders for reports
function formatCustomCakeOrdersForReports(orders, prefix) {
  return orders.map((order) => {
    const isImageBased = prefix === "RCC";
    const orderId = isImageBased ? order.imageBasedOrderId : order.customCakeId;
    const orderDate = getOrderDate(order);

    // Use downpayment_amount if available, otherwise calculate 50% of price
    const totalAmount = order.downpayment_amount
      ? parseFloat(order.downpayment_amount)
      : order.price
      ? parseFloat(order.price) * 0.5
      : 0;

    const fullPrice = order.price ? parseFloat(order.price) : 0;
    const pickupDate = order.deliveryDate || order.createdAt;

    // Enhanced customer info extraction
    let customerName = "Unknown";
    let customerEmail = "No email";
    let customerPhone = "No phone";

    // Try multiple possible locations for customer data
    if (order.customer_name) customerName = order.customer_name;
    else if (order.customer?.name) customerName = order.customer.name;

    if (order.customer_email) customerEmail = order.customer_email;
    else if (order.customer?.email) customerEmail = order.customer.email;

    if (order.customer_phone) customerPhone = order.customer_phone;
    else if (order.customer?.phone) customerPhone = order.customer.phone;

    return {
      orderId: `${prefix}${String(orderId).padStart(3, "0")}`,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      total_amount: totalAmount,
      full_price: fullPrice,
      status: order.status,
      status_key: mapCustomCakeStatus(order.status),
      order_date: orderDate,
      pickup_date: pickupDate,
      delivery_method: order.delivery_method || "pickup",
      payment_method: "gcash",
      items: [
        {
          name: isImageBased ? "Image-Based Custom Cake" : "3D Custom Cake",
          size: order.size || "Not specified",
          quantity: 1,
          price: totalAmount,
          full_price: fullPrice,
          customCakeId: orderId,
          is_custom_cake: true,
          is_image_based: isImageBased,
        },
      ],
      order_type: isImageBased ? "image_cake" : "custom_cake",
      is_custom_cake: true,
      is_image_based: isImageBased,
      downpayment_amount: totalAmount,
    };
  });
}

// Helper method to get order date from different date fields
function getOrderDate(order) {
  if (order.orderDate) return new Date(order.orderDate);
  if (order.createdAt) return new Date(order.createdAt);
  if (order.updatedAt) return new Date(order.updatedAt);
  if (order.order_date) return new Date(order.order_date);
  if (order.deliveryDate) return new Date(order.deliveryDate); // ADD THIS
  return new Date();
}

// Set maximum date to today for date inputs
function initializeDateInputs() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("startDate").max = today;
  document.getElementById("endDate").max = today;
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  initializeDateInputs();
});

const statusMap = {
  Pending: { class: "pending", text: "Pending" },
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

// Map custom cake status to regular order status for styling
function mapCustomCakeStatus(customCakeStatus) {
  return customCakeStatus; // Return the actual status text
}

// Calculate total revenue from custom cake orders
function calculateCustomCakeRevenue(orders) {
  return orders.reduce((total, order) => {
    // Use downpayment_amount if available, otherwise use 50% of price
    if (order.downpayment_amount) {
      return total + parseFloat(order.downpayment_amount);
    } else if (order.price) {
      return total + parseFloat(order.price) * 0.5;
    }
    return total;
  }, 0);
}

// Calculate full price revenue from custom cake orders (for reference)
function calculateCustomCakeFullRevenue(orders) {
  return orders.reduce((total, order) => {
    return total + (order.price ? parseFloat(order.price) : 0);
  }, 0);
}

// Update summary cards
function updateSummaryCards(summary) {
  currentSummaryData = summary;

  // Calculate revenue breakdown for tooltip
  const regularRevenue = parseFloat(summary?.total_revenue) || 0;
  const customCakeDownpaymentRevenue =
    summary?.custom_cake_downpayment_revenue ||
    calculateCustomCakeRevenue(summary?.custom_cake_orders || []) ||
    0;

  const totalRevenue = regularRevenue + customCakeDownpaymentRevenue;

  const cards = [
    { id: "totalOrders", value: summary?.total_orders || 0 },
    {
      id: "totalRevenue",
      value: `PHP ${totalRevenue.toFixed(2)}`,
      title: `Revenue Breakdown:\n• Regular Orders: PHP ${regularRevenue.toFixed(
        2
      )}\n• Custom Cake Downpayments: PHP ${customCakeDownpaymentRevenue.toFixed(
        2
      )}\n• Total: PHP ${totalRevenue.toFixed(2)}`,
    },
    {
      id: "customCakes",
      value: summary?.total_custom_cakes || 0,
      title: `Custom Cakes Breakdown:\n• 3D Custom: ${
        summary?.custom_cake_3d_orders || 0
      }\n• Image-based: ${
        summary?.custom_cake_image_orders || 0
      }\n• Downpayment Revenue: PHP ${customCakeDownpaymentRevenue.toFixed(2)}`,
    },
    {
      id: "avgOrderValue",
      value: `PHP ${(parseFloat(summary?.average_order_value) || 0).toFixed(
        2
      )}`,
    },
  ];

  cards.forEach((card) => {
    const element = document.getElementById(card.id);
    if (element) {
      element.textContent = card.value;
      if (card.title) {
        element.title = card.title;
        element.setAttribute("data-bs-toggle", "tooltip");
        element.setAttribute("data-bs-placement", "top");
      }
    }
  });

  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Update sales table
// Update sales table to show customer contact info and styled order details
function updateSalesTable(orders) {
  const tableBody = document.getElementById("salesTableBody");
  tableBody.innerHTML = "";

  if (!orders || orders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-4 text-muted">No orders found for the selected date range</td>
      </tr>
    `;
    return;
  }

  orders.forEach((order) => {
    const row = document.createElement("tr");
    const items = order.items
      .map((item) => {
        const price = item.price || 0;
        const quantity = item.quantity || 1;
        const fullPrice = item.full_price || price * 2; // Estimate full price if not available

        // Add size information if available - STYLED AS TEXT-MUTED
        const sizeInfo = item.size
          ? `<span class="small text-muted">Size: ${item.size}</span><br>`
          : "";

        // Add custom cake indicator and downpayment info
        const cakeType = item.is_custom_cake
          ? item.is_image_based
            ? " (Image-Based Custom Cake)"
            : " (3D Custom Cake)"
          : "";

        const downpaymentInfo = item.is_custom_cake
          ? `<br><small class="text-muted">50% Downpayment of PHP ${fullPrice.toFixed(
              2
            )}</small>`
          : "";

        return `${
          item.name
        }${cakeType}<br>${sizeInfo}<span class="small text-muted">Qty: ${quantity}</span> - PHP ${(
          price * quantity
        ).toFixed(2)}${downpaymentInfo}`;
      })
      .join("<br><br>");

    const orderDate = new Date(order.order_date).toLocaleDateString();
    const pickupDate = order.pickup_date
      ? new Date(order.pickup_date).toLocaleDateString()
      : "Not set";

    // Safely convert total_amount to number (this is downpayment for custom cakes)
    const totalAmount = order.total_amount || 0;

    // Format payment method
    const paymentMethod = order.payment_method
      ? order.payment_method === "gcash"
        ? "GCash"
        : order.payment_method.charAt(0).toUpperCase() +
          order.payment_method.slice(1)
      : "Unknown";

    // Format delivery method
    const deliveryMethod = order.delivery_method
      ? order.delivery_method.charAt(0).toUpperCase() +
        order.delivery_method.slice(1)
      : "Unknown";

    // Use the comprehensive status map
    const statusInfo = statusMap[order.status] || {
      text: order.status,
      class: "pending",
    };

    // Add downpayment indicator for custom cakes
    const amountDisplay = order.is_custom_cake
      ? `PHP ${totalAmount.toFixed(
          2
        )}<br><small class="text-muted">(50% Downpayment)</small>`
      : `PHP ${totalAmount.toFixed(2)}`;

    // Create customer details with contact info, payment, delivery methods, and dates
    const customerDetails = `
      <div class="customer-info">
        <div class="customer-name fw-bold">${order.customer_name}</div>
        <div class="customer-contact small text-muted">
          <div>${order.customer_email || "No email"}</div>
          <div>${order.customer_phone || "No phone"}</div>
        </div>
        <div class="order-dates small text-muted mt-1">
          <div><strong>Order Date:</Strong> ${orderDate}</div>
          <div><strong>Pickup/Delivery Date:</strong> ${pickupDate}</div>
        </div>
        <div class="payment-method small text-muted"><strong>Payment:</strong> ${paymentMethod}</div>
        <div class="delivery-method small text-muted"><strong>Delivery:</strong> ${deliveryMethod}</div>
      </div>
    `;

    // Format order ID with appropriate styling
    const orderIdCell = getOrderIdCell(order);

    row.innerHTML = `
      <td>${orderIdCell}</td>
      <td>${customerDetails}</td>
      <td>${amountDisplay}</td>
      <td>${items}</td>
      <td><span class="status ${statusInfo.class}">${statusInfo.text}</span></td>
      <td>${orderDate}</td>
    `;
    tableBody.appendChild(row);
  });

  // Add CSS for different order type styling
  addOrderTypeStyles();
}

// Generate order ID cell with appropriate styling
function getOrderIdCell(order) {
  if (order.order_type === "custom_cake") {
    return `<span class="order-id custom-cake-id" title="3D Custom Cake">${order.orderId}</span>`;
  } else if (order.order_type === "image_cake") {
    return `<span class="order-id image-cake-id" title="Image-Based Custom Cake">${order.orderId}</span>`;
  } else {
    return `<span class="order-id regular-id">${order.orderId}</span>`;
  }
}

// Add CSS for different order type styling
function addOrderTypeStyles() {
  if (!document.getElementById("order-type-styles")) {
    const style = document.createElement("style");
    style.id = "order-type-styles";
    style.textContent = `
      .order-id {
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 3px;
      }
      .order-id.regular-id, .order-id.custom-cake-id, .order-id.image-cake-id {
        color: #2e2e2e;
      }
    `;
    document.head.appendChild(style);
  }
}

// Update charts with custom cake data
function updateCharts(
  dailyOrders,
  popularItems,
  customCakeOrders,
  imageBasedOrders
) {
  // Filter out cancelled orders from custom cake data
  const activeCustomCakeOrders = customCakeOrders.filter(
    (order) => order.status !== "Cancelled" && order.status !== "Not Feasible"
  );

  const activeImageBasedOrders = imageBasedOrders.filter(
    (order) => order.status !== "Cancelled" && order.status !== "Not Feasible"
  );

  // Update total orders chart with ACTIVE custom cake data only
  if (dailyOrders && dailyOrders.length > 0) {
    const dates = dailyOrders.map((item) =>
      new Date(item.date).toLocaleDateString()
    );
    const regularOrdersData = dailyOrders.map((item) => item.count);

    // Calculate ACTIVE custom cake orders per day (exclude cancelled)
    const customCakeOrdersData = calculateCustomCakesPerDay(
      dates,
      activeCustomCakeOrders,
      activeImageBasedOrders
    );

    totalOrdersChart.data.labels = dates;
    totalOrdersChart.data.datasets[0].data = regularOrdersData;
    totalOrdersChart.data.datasets[1].data = customCakeOrdersData;
    totalOrdersChart.update();
  }

  // Update popular items chart - filter out custom cake orders AND cancelled orders
  if (popularItems && popularItems.length > 0) {
    // Filter out custom cake items from popular items
    const regularPopularItems = popularItems.filter(
      (item) =>
        !item.item_name.includes("Custom Cake") &&
        !item.item_name.includes("Image-Based") &&
        !item.item_name.includes("3D Custom")
    );

    const itemLabels = regularPopularItems.map((item) => item.item_name);
    const itemData = regularPopularItems.map((item) =>
      parseInt(item.total_quantity)
    );

    popularItemsChart.data.labels = itemLabels;
    popularItemsChart.data.datasets[0].data = itemData;
    popularItemsChart.update();
  }
}

// Calculate custom cake orders per day for the chart
function calculateCustomCakesPerDay(dates, customCakeOrders, imageBasedOrders) {
  // Filter out cancelled orders
  const activeCustomCakes = [...customCakeOrders, ...imageBasedOrders].filter(
    (order) => order.status !== "Cancelled" && order.status !== "Not Feasible"
  );

  const ordersPerDay = {};

  //all dates start with 0
  dates.forEach((date) => {
    ordersPerDay[date] = 0;
  });

  // Count ACTIVE custom cake orders per day
  activeCustomCakes.forEach((order) => {
    const orderDate = getOrderDate(order);
    const dateString = orderDate.toLocaleDateString();

    if (ordersPerDay.hasOwnProperty(dateString)) {
      ordersPerDay[dateString]++;
    }
  });

  // Convert to array in the same order with dates
  return dates.map((date) => ordersPerDay[date] || 0);
}

// Error handling
function showError(message) {
  let errorAlert = document.getElementById("errorAlert");
  if (!errorAlert) {
    errorAlert = document.createElement("div");
    errorAlert.id = "errorAlert";
    errorAlert.className = "alert alert-danger alert-dismissible fade show";
    errorAlert.innerHTML = `
      <span id="errorMessage"></span>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector(".content").prepend(errorAlert);
  }
  document.getElementById("errorMessage").textContent = message;
  errorAlert.style.display = "block";
}

// Excel export function
// Excel export function - UPDATED WITH CONTACT INFO
function exportToExcel() {
  if (isLoading) return;

  const table = document.getElementById("salesTable");
  const dateRange = `${document.getElementById("startDate").value}_to_${
    document.getElementById("endDate").value
  }`;
  const filename = `Sales_Report_${dateRange}.xls`;

  // Create a clone of the table for export
  const tableClone = table.cloneNode(true);

  // Process customer details for Excel (extract from HTML) - UPDATED WITH CONTACT INFO
  const customerCells = tableClone.querySelectorAll("td:nth-child(2)");
  customerCells.forEach((cell) => {
    const customerName =
      cell.querySelector(".customer-name")?.textContent || "Unknown Customer";
    const customerEmail =
      cell
        .querySelector(".customer-contact")
        ?.children[0]?.textContent?.replace("📧 ", "") || "No email";
    const customerPhone =
      cell
        .querySelector(".customer-contact")
        ?.children[1]?.textContent?.replace("📞 ", "") || "No phone";
    const paymentMethod =
      cell
        .querySelector(".payment-method")
        ?.textContent?.replace("Payment: ", "") || "Unknown";
    const deliveryMethod =
      cell
        .querySelector(".delivery-method")
        ?.textContent?.replace("Delivery: ", "") || "Unknown";

    cell.innerHTML = `${customerName}<br>Email: ${customerEmail}<br>Phone: ${customerPhone}<br>Payment: ${paymentMethod}<br>Delivery: ${deliveryMethod}`;
  });

  // Process order details for Excel - remove text-muted styling but keep content
  const orderDetailCells = tableClone.querySelectorAll("td:nth-child(4)");
  orderDetailCells.forEach((cell) => {
    // Remove the text-muted class spans but keep the content
    const htmlContent = cell.innerHTML;
    const cleanContent = htmlContent
      .replace(/<span class="text-muted">/g, "")
      .replace(/<\/span>/g, "")
      .replace(/<small class="text-muted">/g, "")
      .replace(/<\/small>/g, "");
    cell.innerHTML = cleanContent;
  });

  // Calculate summary from the actual table data - UPDATED FOR DOWNPAYMENTS
  const rows = tableClone.querySelectorAll("tbody tr");
  let totalOrders = 0;
  let totalRevenue = 0;
  let regularOrders = 0;
  let customCakeOrders = 0;
  let regularRevenue = 0;
  let customCakeDownpaymentRevenue = 0;

  // Count only data rows (exclude summary/title rows we'll add)
  rows.forEach((row) => {
    // Skip rows that are not data rows (empty or placeholder rows)
    if (row.cells.length < 6) return;

    const firstCell = row.cells[0];
    const amountCell = row.cells[2];

    // Check if this is a data row (has order ID and amount)
    if (firstCell && amountCell && firstCell.textContent.trim() !== "") {
      // Skip the "No orders found" row
      if (firstCell.textContent.includes("No orders found")) return;

      totalOrders++;

      // Check order type and calculate revenue
      const orderIdSpan = firstCell.querySelector(".order-id");
      const amountText = amountCell.textContent.trim();

      // Parse amount - handle downpayment notation
      let amountValue = 0;
      if (amountText.includes("PHP")) {
        const cleanAmount = amountText
          .replace(/PHP\s?/gi, "")
          .replace(/,/g, "")
          .replace(/\(.*\)/g, "") // Remove parentheses content (like "50% Downpayment")
          .trim();
        amountValue = parseFloat(cleanAmount) || 0;
      } else {
        const cleanAmount = amountText.replace(/,/g, "").trim();
        amountValue = parseFloat(cleanAmount) || 0;
      }

      totalRevenue += amountValue;

      if (orderIdSpan) {
        if (orderIdSpan.classList.contains("regular-id")) {
          regularOrders++;
          regularRevenue += amountValue;
        } else if (
          orderIdSpan.classList.contains("custom-cake-id") ||
          orderIdSpan.classList.contains("image-cake-id")
        ) {
          customCakeOrders++;
          customCakeDownpaymentRevenue += amountValue;
        }
      }
    }
  });

  // Add PHP formatting to amount cells for consistency
  const amountCells = tableClone.querySelectorAll("td:nth-child(3)");
  amountCells.forEach((cell) => {
    const amountText = cell.textContent.trim();
    if (!amountText.includes("PHP") && amountText !== "") {
      const amountValue = parseFloat(amountText.replace(/,/g, "")) || 0;
      cell.textContent = `PHP ${amountValue.toFixed(2)}`;
    }
  });

  // Add a title and summary row
  const titleRow = document.createElement("tr");
  titleRow.innerHTML = `<td colspan="6" style="text-align: center; font-size: 16px; font-weight: bold; background-color: #2c9045; color: white; padding: 15px;">SALES REPORT</td>`;

  const dateRangeRow = document.createElement("tr");
  dateRangeRow.innerHTML = `<td colspan="6" style="text-align: center; font-style: italic; padding: 10px;">Date Range: ${
    document.getElementById("startDate").value
  } to ${document.getElementById("endDate").value}</td>`;

  const summaryRow = document.createElement("tr");
  summaryRow.innerHTML = `<td colspan="6" style="text-align: center; font-weight: bold; background-color: #f5f5f5; padding: 12px;">
    Summary: ${totalOrders} Total Orders (${regularOrders} Regular, ${customCakeOrders} Custom Cakes) | 
    PHP ${totalRevenue.toFixed(2)} Total Revenue (PHP ${regularRevenue.toFixed(
    2
  )} Regular + PHP ${customCakeDownpaymentRevenue.toFixed(
    2
  )} Custom Cake Downpayments)
  </td>`;

  const generatedRow = document.createElement("tr");
  generatedRow.innerHTML = `<td colspan="6" style="text-align: center; font-size: 12px; color: #666; padding: 10px;">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
  </td>`;

  // Insert the additional rows
  const tbody = tableClone.querySelector("tbody");

  // Clear any existing summary rows first
  const existingSummaryRows = tbody.querySelectorAll("tr");
  existingSummaryRows.forEach((row) => {
    if (row.querySelector('td[colspan="6"]')) {
      row.remove();
    }
  });

  // Add new summary rows at the beginning
  tbody.insertBefore(titleRow, tbody.firstChild);
  tbody.insertBefore(dateRangeRow, titleRow.nextSibling);

  // Add summary and generated rows at the end
  tbody.appendChild(summaryRow);
  tbody.appendChild(generatedRow);

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8">
      <title>Sales Report</title>
      <style>
        body { font-family: Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #2c9045; color: white; font-weight: bold; padding: 10px; text-align: left; border: 1px solid #ddd; }
        td { padding: 8px; border: 1px solid #ddd; vertical-align: top; }
        tr:nth-child(even) { background-color: #f2f2f2; }
        .status { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status.pending { background-color: #fff3cd; color: #856404; }
        .status.ready-for-dp { background-color: #d1ecf1; color: #0c5460; }
        .status.dp-paid { background-color: #d4edda; color: #155724; }
        .status.in-progress { background-color: #cce5ff; color: #004085; }
        .status.ready { background-color: #d1f7c4; color: #0f5132; }
        .status.delivered { background-color: #d1e7dd; color: #0f5132; }
        .status.cancelled { background-color: #f8d7da; color: #721c24; }
        .order-id.regular-id { color: #2c9045; font-weight: bold; }
        .order-id.custom-cake-id { color: #e91e63; font-weight: bold; background-color: #fce4ec; }
        .order-id.image-cake-id { color: #ff9800; font-weight: bold; background-color: #fff3e0; }
        .downpayment-note { font-size: 11px; color: #666; font-style: italic; }
      </style>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Sales Report</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
                <x:Print>
                  <x:ValidPrinterInfo/>
                  <x:HorizontalResolution>600</x:HorizontalResolution>
                  <x:VerticalResolution>600</x:VerticalResolution>
                </x:Print>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body>
      ${tableClone.outerHTML}
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Event listeners
document.getElementById("applyDateFilter").addEventListener("click", () => {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (!startDate || !endDate) {
    showError("Please select both start and end dates");
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    showError("Start date cannot be after end date");
    return;
  }

  updateReports(startDate, endDate);
});

document.getElementById("exportExcel").addEventListener("click", exportToExcel);

document.querySelector(".search-bar").addEventListener("input", (e) => {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll("#salesTable tbody tr").forEach((row) => {
    const orderId = row.cells[0].textContent.toLowerCase();
    const customerName = row.cells[1].textContent.toLowerCase();
    const orderDetails = row.cells[3].textContent.toLowerCase();

    row.style.display =
      orderId.includes(searchTerm) ||
      customerName.includes(searchTerm) ||
      orderDetails.includes(searchTerm)
        ? ""
        : "none";
  });
});

//Filter by status
document.getElementById("applyFilter").addEventListener("click", () => {
  const selectedStatus = document
    .getElementById("filterStatus")
    .value.toLowerCase();

  document.querySelectorAll("#salesTable tbody tr").forEach((row) => {
    // Skip summary rows
    if (row.querySelector("td[colspan]")) return;

    const statusElement = row.cells[4]?.querySelector(".status");
    const rowStatus = statusElement
      ? statusElement.textContent.trim().toLowerCase()
      : "";

    let shouldShow = false;

    if (selectedStatus === "") {
      shouldShow = true;
    } else {
      // Use exact matching for all statuses
      shouldShow = rowStatus === selectedStatus;
    }

    row.style.display = shouldShow ? "" : "none";
  });

  // Close modal after applying filter
  const filterModal = bootstrap.Modal.getInstance(
    document.getElementById("filterModal")
  );
  if (filterModal) filterModal.hide();
});

// Initialize with default date range (last 30 days)
const endDate = new Date().toISOString().split("T")[0];
const startDate = new Date(new Date().setDate(new Date().getDate() - 30))
  .toISOString()
  .split("T")[0];

document.getElementById("startDate").value = startDate;
document.getElementById("endDate").value = endDate;

// Initial load - call updateReports at the END after it's defined
setTimeout(() => updateReports(startDate, endDate), 100);
