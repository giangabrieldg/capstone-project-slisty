let currentSummaryData = null;

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

    // Fetch data from all endpoints in parallel
    const [reportsResponse, customCakeData, imageBasedData] = await Promise.all([
      fetch(`${window.API_BASE_URL}/api/orders/admin/reports?start_date=${startDate}&end_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/orders?start_date=${startDate}&end_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/image-orders?start_date=${startDate}&end_date=${endDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
    ]);

    if (!reportsResponse.ok) {
      if (reportsResponse.status === 401 || reportsResponse.status === 403) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`Server returned ${reportsResponse.status}`);
    }

    const data = await reportsResponse.json();
    const customCakeOrders = customCakeData.ok ? (await customCakeData.json()).orders || [] : [];
    const imageBasedOrders = imageBasedData.ok ? (await imageBasedData.json()).orders || [] : [];

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch reports");
    }

    // Combine all orders: regular orders + custom cake orders
    const allOrders = [
      ...data.orders.map(order => ({ ...order, order_type: 'regular' })),
      ...formatCustomCakeOrdersForReports(customCakeOrders, 'CC'),
      ...formatCustomCakeOrdersForReports(imageBasedOrders, 'RCC')
    ];

    // Sort all orders by date (newest first)
    allOrders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    // Update summary to include custom cakes
    const updatedSummary = {
      ...data.summary,
      total_custom_cakes: customCakeOrders.length + imageBasedOrders.length,
      custom_cake_3d_orders: customCakeOrders.length,
      custom_cake_image_orders: imageBasedOrders.length,
      total_orders: (data.summary.total_orders || 0) + customCakeOrders.length + imageBasedOrders.length,
      total_revenue: (parseFloat(data.summary.total_revenue) || 0) + 
                    calculateCustomCakeRevenue(customCakeOrders) + 
                    calculateCustomCakeRevenue(imageBasedOrders)
    };

    // Update all components
    updateSummaryCards(updatedSummary);
    updateSalesTable(allOrders);
    updateCharts(data.daily_orders, data.popular_items, customCakeOrders, imageBasedOrders);
  } catch (error) {
    console.error("Error fetching reports:", error);
    showError("Failed to load reports. Please try again.");
  } finally {
    setLoadingState(false);
  }
}

// Format custom cake orders for reports
function formatCustomCakeOrdersForReports(orders, prefix) {
  return orders.map(order => {
    const isImageBased = prefix === 'RCC';
    const orderId = isImageBased ? order.imageBasedOrderId : order.customCakeId;
    const orderDate = getOrderDate(order);
    
    // Ensure price is a number
    const totalAmount = order.price ? parseFloat(order.price) : 0;
    
    return {
      orderId: `${prefix}${String(orderId).padStart(3, '0')}`,
      customer_name: order.customer_name || (order.customer?.name || 'Unknown'),
      customer_email: order.customer_email || (order.customer?.email || 'No email'),
      total_amount: totalAmount,
      status: order.status,
      status_key: mapCustomCakeStatus(order.status),
      order_date: orderDate,
      delivery_method: order.delivery_method || 'pickup',
      payment_method: 'gcash',
      items: [{
        name: isImageBased ? 'Image-Based Cake' : '3D Custom Cake',
        size: order.size || 'Not specified',
        quantity: 1,
        price: totalAmount,
        customCakeId: orderId,
        is_custom_cake: true,
        is_image_based: isImageBased
      }],
      order_type: isImageBased ? 'image_cake' : 'custom_cake',
      is_custom_cake: true,
      is_image_based: isImageBased
    };
  });
}

// Helper method to get order date from different date fields
function getOrderDate(order) {
  if (order.orderDate) return new Date(order.orderDate);
  if (order.createdAt) return new Date(order.createdAt);
  if (order.updatedAt) return new Date(order.updatedAt);
  if (order.order_date) return new Date(order.order_date);
  return new Date();
}

// Set maximum date to today for date inputs
function initializeDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById("startDate").max = today;
  document.getElementById("endDate").max = today;
}

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function() {
  initializeDateInputs();
});

const statusMap = {
      'Pending Review': { class: 'pending', text: 'Pending Review' },
      'Ready for Downpayment': { class: 'ready-for-dp', text: 'Ready for Downpayment' },
      'Downpayment Paid': { class: 'dp-paid', text: 'Downpayment Paid' },
      'Order Received': { class: 'order-received', text: 'Order Received' },
      'In Progress': { class: 'in-progress', text: 'In Progress' },
      'Ready for Pickup/Delivery': { class: 'ready', text: 'Ready for Pickup/Delivery' },
      'Completed': { class: 'delivered', text: 'Completed' },
      'Cancelled': { class: 'cancelled', text: 'Cancelled' },
      'Not Feasible': { class: 'cancelled', text: 'Not Feasible' }
    };
    
// Map custom cake status to regular order status for styling
function mapCustomCakeStatus(customCakeStatus) {
  return customCakeStatus; // Return the actual status text
}

// Calculate total revenue from custom cake orders
function calculateCustomCakeRevenue(orders) {
  return orders.reduce((total, order) => {
    return total + (order.price ? parseFloat(order.price) : 0);
  }, 0);
}

// Update summary cards
function updateSummaryCards(summary) {
  currentSummaryData = summary;
  
  const cards = [
    { id: "totalOrders", value: summary?.total_orders || 0 },
    {
      id: "totalRevenue",
      value: `PHP ${(parseFloat(summary?.total_revenue) || 0).toFixed(2)}`,
    },
    { 
      id: "customCakes", 
      value: summary?.total_custom_cakes || 0,
      title: `3D Custom: ${summary?.custom_cake_3d_orders || 0}\nImage-based: ${summary?.custom_cake_image_orders || 0}`
    },
    {
      id: "avgOrderValue",
      value: `PHP ${(parseFloat(summary?.average_order_value) || 0).toFixed(2)}`,
    },
  ];

  cards.forEach((card) => {
    const element = document.getElementById(card.id);
    if (element) {
      element.textContent = card.value;
      if (card.title) {
        element.title = card.title;
        element.setAttribute('data-bs-toggle', 'tooltip');
        element.setAttribute('data-bs-placement', 'top');
      }
    }
  });

  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(function (tooltipTriggerEl) {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
}

// Update sales table
function updateSalesTable(orders) {
  const tableBody = document.getElementById("salesTableBody");
  tableBody.innerHTML = "";

  if (!orders || orders.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-4 text-muted">No orders found for the selected date range</td>
      </tr>
    `;
    return;
  }

  orders.forEach((order) => {
    const row = document.createElement("tr");
    const items = order.items
      .map((item) => {
        const price = typeof item.price === "number" ? item.price : parseFloat(item.price) || 0;
        const quantity = typeof item.quantity === "number" ? item.quantity : parseInt(item.quantity) || 0;
        
        // Add size information if available
        const sizeInfo = item.size ? `Size: ${item.size}<br>` : "";
        
        // Add custom cake indicator
        const cakeType = item.is_custom_cake ? 
          (item.is_image_based ? ' (Image-Based)' : ' (3D Custom)') : '';
        
        return `${item.name}${cakeType}<br>${sizeInfo}Qty: ${quantity} - PHP ${(price * quantity).toFixed(2)}`;
      })
      .join("<br><br>"); 

    const orderDate = new Date(order.order_date).toLocaleDateString();
    const pickupDate = order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : 'Not set';

    // Safely convert total_amount to number
    const totalAmount = typeof order.total_amount === "number" ? order.total_amount : parseFloat(order.total_amount) || 0;

    // Format payment method
    const paymentMethod = order.payment_method ? 
      (order.payment_method === 'gcash' ? 'GCash' : 
       order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1)) : 
      "Unknown";

    // Format delivery method
    const deliveryMethod = order.delivery_method ? order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1) : "Unknown";

    // Use the comprehensive status map
    const statusInfo = statusMap[order.status] || {
      text: order.status,
      class: 'pending'
    };

    // Create customer details with payment, delivery methods, and dates
    const customerDetails = `
      <div class="customer-info">
        <div class="customer-name fw-bold">${order.customer_name}</div>
        <div class="order-dates small text-muted">
          <div>Order Date: ${orderDate}</div>
          <div>Pickup Date: ${pickupDate}</div>
        </div>
        <div class="payment-method small text-muted">Payment: ${paymentMethod}</div>
        <div class="delivery-method small text-muted">Delivery: ${deliveryMethod}</div>
      </div>
    `;

    // Format order ID with appropriate styling
    const orderIdCell = getOrderIdCell(order);
    
    row.innerHTML = `
      <td>${orderIdCell}</td>
      <td>${customerDetails}</td>
      <td>PHP ${totalAmount.toFixed(2)}</td>
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
  if (order.order_type === 'custom_cake') {
    return `<span class="order-id custom-cake-id" title="3D Custom Cake">${order.orderId}</span>`;
  } else if (order.order_type === 'image_cake') {
    return `<span class="order-id image-cake-id" title="Image-Based Custom Cake">${order.orderId}</span>`;
  } else {
    return `<span class="order-id regular-id">${order.orderId}</span>`;
  }
}

// Add CSS for different order type styling
function addOrderTypeStyles() {
  if (!document.getElementById('order-type-styles')) {
    const style = document.createElement('style');
    style.id = 'order-type-styles';
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
function updateCharts(dailyOrders, popularItems, customCakeOrders, imageBasedOrders) {
  // Update total orders chart with custom cake data
  if (dailyOrders && dailyOrders.length > 0) {
    const dates = dailyOrders.map((item) =>
      new Date(item.date).toLocaleDateString()
    );
    const regularOrdersData = dailyOrders.map((item) => item.count);
    
    // Calculate custom cake orders per day
    const customCakeOrdersData = calculateCustomCakesPerDay(dates, customCakeOrders, imageBasedOrders);

    totalOrdersChart.data.labels = dates;
    totalOrdersChart.data.datasets[0].data = regularOrdersData;
    totalOrdersChart.data.datasets[1].data = customCakeOrdersData;
    totalOrdersChart.update();
  }

  // Update popular items chart - filter out custom cake orders
  if (popularItems && popularItems.length > 0) {
    // Filter out custom cake items from popular items
    const regularPopularItems = popularItems.filter(item => 
      !item.item_name.includes('Custom Cake') && 
      !item.item_name.includes('Image-Based') &&
      !item.item_name.includes('3D Custom')
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
  const allCustomCakes = [...customCakeOrders, ...imageBasedOrders];
  const ordersPerDay = {};
  
  // Initialize all dates with 0
  dates.forEach(date => {
    ordersPerDay[date] = 0;
  });
  
  // Count custom cake orders per day
  allCustomCakes.forEach(order => {
    const orderDate = getOrderDate(order);
    const dateString = orderDate.toLocaleDateString();
    
    if (ordersPerDay.hasOwnProperty(dateString)) {
      ordersPerDay[dateString]++;
    }
  });
  
  // Convert to array in the same order as dates
  return dates.map(date => ordersPerDay[date] || 0);
}

// Error handling
function showError(message) {
  let errorAlert = document.getElementById("errorAlert");
  if (!errorAlert) {
    errorAlert = document.createElement("div");
    errorAlert.id = "errorAlert";
    errorAlert.className =
      "alert alert-danger alert-dismissible fade show";
    errorAlert.innerHTML = `
      <span id="errorMessage"></span>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector(".content").prepend(errorAlert);
  }
  document.getElementById("errorMessage").textContent = message;
  errorAlert.style.display = "block";
}

// Pure JavaScript Excel export function
function exportToExcel() {
  if (isLoading) return;

  const table = document.getElementById("salesTable");
  const dateRange = `${document.getElementById("startDate").value}_to_${
    document.getElementById("endDate").value
  }`;
  const filename = `Sales_Report_${dateRange}.xls`;

  // Create a clone of the table for export
  const tableClone = table.cloneNode(true);

  // Process customer details for Excel (extract from HTML)
  const customerCells = tableClone.querySelectorAll("td:nth-child(2)");
  customerCells.forEach((cell) => {
    const customerName =
      cell.querySelector(".customer-name")?.textContent ||
      "Unknown Customer";
    const paymentMethod =
      cell
        .querySelector(".payment-method")
        ?.textContent?.replace("Payment: ", "") || "Unknown";
    const deliveryMethod =
      cell
        .querySelector(".delivery-method")
        ?.textContent?.replace("Delivery: ", "") || "Unknown";

    cell.innerHTML = `${customerName}<br>Payment: ${paymentMethod}<br>Delivery: ${deliveryMethod}`;
  });

  // Add PHP formatting to amount cells
  const amountCells = tableClone.querySelectorAll("td:nth-child(3)");
  amountCells.forEach((cell) => {
    if (cell.textContent.includes("PHP")) {
      cell.textContent = cell.textContent.replace("PHP", "PHP ");
    }
  });

  // Calculate summary from the actual table data
  const rows = tableClone.querySelectorAll("tbody tr");
  let totalOrders = 0;
  let totalRevenue = 0;
  let regularOrders = 0;
  let customCakeOrders = 0;

  // Count only data rows (exclude summary/title rows we'll add)
  rows.forEach(row => {
    // Check if this is a data row (has order ID)
    const firstCell = row.querySelector('td:first-child');
    if (firstCell && firstCell.textContent.startsWith('#')) {
      totalOrders++;
      
      // Check order type
      const orderIdSpan = firstCell.querySelector('.order-id');
      if (orderIdSpan) {
        if (orderIdSpan.classList.contains('regular-id')) {
          regularOrders++;
        } else if (orderIdSpan.classList.contains('custom-cake-id') || orderIdSpan.classList.contains('image-cake-id')) {
          customCakeOrders++;
        }
      }
      
      // Get revenue from amount cell (3rd cell)
      const amountCell = row.querySelector('td:nth-child(3)');
      if (amountCell) {
        const amountText = amountCell.textContent.replace('PHP ', '').replace(/,/g, '');
        totalRevenue += parseFloat(amountText) || 0;
      }
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
    Summary: ${totalOrders} Total Orders (${regularOrders} Regular, ${customCakeOrders} Custom Cakes) | PHP ${totalRevenue.toFixed(2)} Total Revenue
  </td>`;

  const generatedRow = document.createElement("tr");
  generatedRow.innerHTML = `<td colspan="6" style="text-align: center; font-size: 12px; color: #666; padding: 10px;">
    Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
  </td>`;

  // Insert the additional rows
  const tbody = tableClone.querySelector("tbody");
  
  // Clear any existing summary rows first
  const existingSummaryRows = tbody.querySelectorAll('tr');
  existingSummaryRows.forEach(row => {
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

document
  .getElementById("exportExcel")
  .addEventListener("click", exportToExcel);

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


document.getElementById("applyFilter").addEventListener("click", () => {
  const selectedStatus = document.getElementById("filterStatus").value.toLowerCase();
  
  document.querySelectorAll("#salesTable tbody tr").forEach((row) => {
    // Skip summary rows
    if (row.querySelector('td[colspan]')) return;

    const statusElement = row.cells[4]?.querySelector(".status");
    const rowStatus = statusElement ? statusElement.textContent.trim().toLowerCase() : "";

    // Check if row matches selected filter
    if (selectedStatus === "" || rowStatus.includes(selectedStatus)) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  // Close modal after applying filter
  const filterModal = bootstrap.Modal.getInstance(document.getElementById("filterModal"));
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