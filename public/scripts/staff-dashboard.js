// Check if staff is authenticated
if (!localStorage.getItem('token')) {
  window.location.href = '/customer/login.html';
}

// Fetch and display orders
async function fetchOrders() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/orders`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch orders');
    const orders = await response.json();
    const tbody = document.querySelector('.order-list');
    tbody.innerHTML = '';

    orders.forEach(order => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${order.orderID}</td>
        <td>${order.customerName}</td>
        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
        <td>₱${order.total.toFixed(2)}</td>
        <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
        <td>
          <button class="btn btn-sm btn-primary update-status-btn" data-order-id="${order.orderID}">
            Update Status
          </button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Add event listeners for status update buttons
    document.querySelectorAll('.update-status-btn').forEach(button => {
      button.addEventListener('click', async () => {
        const orderId = button.getAttribute('data-order-id');
        const newStatus = prompt('Enter new status (e.g., Processing, Completed):');
        if (newStatus) {
          try {
            const response = await fetch(`${window.API_BASE_URL}/api/orders/${orderId}/status`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) throw new Error('Failed to update order status');
            await fetchOrders();
            alert('Order status updated successfully!');
          } catch (error) {
            console.error('Error updating order status:', error);
            alert(`Error: ${error.message}`);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    alert('Failed to load orders');
  }
}

// Search functionality
document.querySelector('.search-bar').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll('.order-list tr').forEach((row) => {
    const orderId = row.cells[0].textContent.toLowerCase();
    const customer = row.cells[1].textContent.toLowerCase();
    row.style.display = orderId.includes(searchTerm) || customer.includes(searchTerm) ? '' : 'none';
  });
});

// Sidebar toggle functionality
const sidebarToggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
const body = document.body;

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('show');
  body.classList.toggle('sidebar-visible');
});

document.addEventListener('click', (e) => {
  if (
    window.innerWidth <= 992 &&
    !sidebar.contains(e.target) &&
    !sidebarToggle.contains(e.target) &&
    sidebar.classList.contains('show')
  ) {
    sidebar.classList.remove('show');
    body.classList.remove('sidebar-visible');
  }
});

// Initial fetch of orders
fetchOrders();