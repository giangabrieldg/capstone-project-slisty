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
        label: "Total Orders",
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
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login.html";
      return;
    }

    const url = `/api/orders/admin/reports?start_date=${startDate}&end_date=${endDate}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login.html";
        return;
      }
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch reports");
    }

    // Update all components
    updateSummaryCards(data.summary);
    updateSalesTable(data.orders);
    updateCharts(data.daily_orders, data.popular_items);
  } catch (error) {
    console.error("Error fetching reports:", error);
    showError("Failed to load reports. Please try again.");
  } finally {
    setLoadingState(false);
  }
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
    { id: "customCakes", value: summary?.custom_cake_orders || 0 },
    {
      id: "avgOrderValue",
      value: `PHP ${(parseFloat(summary?.average_order_value) || 0).toFixed(2)}`,
    },
  ];

  cards.forEach((card) => {
    const element = document.getElementById(card.id);
    if (element) {
      element.textContent = card.value;
    }
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
        
        return `${item.name}<br>${sizeInfo}Qty: ${quantity} - PHP ${(price * quantity).toFixed(2)}`;
      })
      .join("<br><br>"); 

    const orderDate = new Date(order.order_date).toLocaleDateString();
    const pickupDate = order.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : 'Not set';

    // Safely convert total_amount to number
    const totalAmount = typeof order.total_amount === "number" ? order.total_amount : parseFloat(order.total_amount) || 0;

    // Format payment method
    const paymentMethod = order.payment_method ? order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1) : "Unknown";

    // Format delivery method
    const deliveryMethod = order.delivery_method ? order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1) : "Unknown";

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
    
    row.innerHTML = `
      <td>#${order.orderId}</td> 
      <td>${customerDetails}</td>
      <td>PHP ${totalAmount.toFixed(2)}</td>
      <td>${items}</td>
      <td><span class="status ${order.status_key.toLowerCase()}">${order.status}</span></td>
      <td>${orderDate}</td>
    `;
    tableBody.appendChild(row);
  });
}

// Update charts
function updateCharts(dailyOrders, popularItems) {
  // Update total orders chart
  if (dailyOrders && dailyOrders.length > 0) {
    const dates = dailyOrders.map((item) =>
      new Date(item.date).toLocaleDateString()
    );
    const totalOrdersData = dailyOrders.map((item) => item.count);

    totalOrdersChart.data.labels = dates;
    totalOrdersChart.data.datasets[0].data = totalOrdersData;
    totalOrdersChart.update();
  }

  // Update popular items chart
  if (popularItems && popularItems.length > 0) {
    const itemLabels = popularItems.map((item) => item.item_name);
    const itemData = popularItems.map((item) =>
      parseInt(item.total_quantity)
    );

    popularItemsChart.data.labels = itemLabels;
    popularItemsChart.data.datasets[0].data = itemData;
    popularItemsChart.update();
  }
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

  // Count only data rows (exclude summary/title rows we'll add)
  rows.forEach(row => {
    // Check if this is a data row (has order ID)
    const firstCell = row.querySelector('td:first-child');
    if (firstCell && firstCell.textContent.startsWith('#')) {
      totalOrders++;
      
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
    Summary: ${totalOrders} Orders | PHP ${totalRevenue.toFixed(2)} Total Revenue
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
        .status.processing { background-color: #cce5ff; color: #004085; }
        .status.shipped { background-color: #d4edda; color: #155724; }
        .status.delivered { background-color: #d1ecf1; color: #0c5460; }
        .status.cancelled { background-color: #f8d7da; color: #721c24; }
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
document
  .getElementById("applyDateFilter")
  .addEventListener("click", () => {
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
  const status = document
    .getElementById("filterStatus")
    .value.toLowerCase();
  document.querySelectorAll("#salesTable tbody tr").forEach((row) => {
    const rowStatusElement = row.cells[4].querySelector(".status");
    const rowStatus = rowStatusElement
      ? rowStatusElement.textContent.trim().toLowerCase()
      : "";

    row.style.display =
      status === "" || rowStatus === status ? "" : "none";
  });

  bootstrap.Modal.getInstance(
    document.getElementById("filterModal")
  ).hide();
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