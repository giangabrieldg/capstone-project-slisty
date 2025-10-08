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
    document.addEventListener('DOMContentLoaded', () => {
      this.fetchUserInfo();
      this.fetchOrders();
      this.setupEventListeners();
    });
  }

  // Fetches user info to display in sidebar
  async fetchUserInfo() {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profil`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.user) {
        document.getElementById('userName').textContent = data.user.name || 'Admin Name';
        document.getElementById('userRole').textContent = data.user.userLevel === 'admin' ? 'Admin' : 'Staff';
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }

  // Fetches orders from backend
  async fetchOrders() {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please login as admin or staff');
      window.location.href = '/public/index.html';
      return;
    }
    try {
      const response = await fetch('/api/orders/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      this.orders = data.orders;
      this.renderOrders(this.orders);
      this.applyFilters();
    } catch (error) {
      console.error('Error fetching orders:', error);
      alert('Failed to load orders: ' + error.message);
    }
  }
  
// Renders orders in the table
renderOrders(orders) {
  const tbody = document.getElementById('ordersTableBody');
  if (!tbody) return;

  // Additional frontend filtering for safety
  const normalOrders = orders.filter(order => {
    return !order.items.some(item => item.customCakeId);
  });

  tbody.innerHTML = normalOrders.map(order => {
    const statusMap = {
      pending: 'Pending',
      pending_payment: 'Pending Payment', 
      processing: 'In Progress',
      shipped: 'Ready for Delivery',
      delivered: 'Completed',
      cancelled: 'Cancelled'
    };

    // Define the next status for each current status
    const nextStatusMap = {
      pending: 'processing',
      pending_payment: 'processing',
      processing: 'shipped',
      shipped: 'delivered'
      // delivered and cancelled have no next status
    };

    const nextStatus = nextStatusMap[order.status];
    const nextStatusText = nextStatus ? statusMap[nextStatus] : null;

    const paymentStatus = order.payment_method === 'cash' ? (order.status === 'delivered' ? 'paid' : 'unpaid') : (order.payment_verified ? 'paid' : 'unpaid');
    const paymentMethod = order.payment_method === 'gcash' ? 'GCash' : 'Cash';

    // Format order date and pickup date similarly
    const orderDate = order.createdAt.split('T')[0];
    const pickupDate = order.pickup_date ? order.pickup_date.split('T')[0] : 'Not set';

    // Format customer details with delivery address
    const customerDetails = `
      <div class="customer-info">
        <div class="customer-name fw-bold">${order.customer_name}</div>
        <div class="customer-contact small text-muted">
          ${order.customer_email}<br>${order.customer_phone}
        </div>
        <div class="delivery-method small text-muted mt-1">
          <strong>Method:</strong> ${order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1)}
        </div>
        ${order.delivery_method === 'delivery' && order.delivery_address ? `
          <div class="delivery-address small text-muted mt-1">
            <strong>Delivery Address:</strong><br>
            ${order.delivery_address}
          </div>
        ` : ''}
        <div class="payment-method small text-muted mt-1">
          <strong>Payment:</strong> ${paymentMethod} 
          <span class="status ${paymentStatus}">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span>
        </div>
      </div>
    `;
    
    // Format items with size information (only regular menu items)
    const items = order.items
      .filter(item => !item.customCakeId)
      .map(item => {
        const sizeInfo = item.size ? `Size: ${item.size}<br>` : '';
        return `${item.name}<br>${sizeInfo}Qty: ${item.quantity} - PHP ${(item.price * item.quantity).toFixed(2)}`;
      })
      .join("<br><br>");
    
    // Skip orders that have no regular items after filtering
    if (items.length === 0) {
      return '';
    }
    
    return `
      <tr data-order-date="${orderDate}">
        <td>ORD${order.orderId.toString().padStart(3, '0')}</td>
        <td>${customerDetails}</td>
        <td>${orderDate}</td>
        <td>${pickupDate}</td>
        <td>PHP ${Number(order.total_amount).toFixed(2)}</td>
        <td>${items}</td>
        <td>${order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1)}</td>
        <td><span class="status ${order.status}">${statusMap[order.status]}</span></td>
        <td>
          ${!order.payment_verified && order.payment_method === 'cash' ? `
            <button class="btn btn-success btn-sm confirm-payment" data-order-id="${order.orderId}">
              Confirm Payment
            </button>
          ` : ''}
          ${nextStatus ? `
            <button class="btn btn-primary btn-sm update-status-btn" data-order-id="${order.orderId}" data-next-status="${nextStatus}">
              Mark as ${nextStatusText}
            </button>
          ` : `
            <span class="text-muted small">No further actions</span>
          `}
          ${order.status !== 'cancelled' && order.status !== 'delivered' ? `
            <button class="btn btn-outline-danger btn-sm cancel-order-btn" data-order-id="${order.orderId}">
              Cancel Order
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}
 setupEventListeners() {
  // Search
  document.querySelector('.search-bar').addEventListener('input', () => this.applyFilters());
  // Date picker
  document.getElementById('datePicker').addEventListener('change', () => this.applyFilters());
  // Filter modal
  document.getElementById('applyFilter').addEventListener('click', () => {
    this.applyFilters();
    bootstrap.Modal.getInstance(document.getElementById('filterModal')).hide();
  });
  
  // Confirm payment and update status (delegated events)
  document.getElementById('ordersTableBody').addEventListener('click', (e) => {
    const confirmBtn = e.target.closest('.confirm-payment');
    const updateBtn = e.target.closest('.update-status-btn');
    const cancelBtn = e.target.closest('.cancel-order-btn');
    
    if (confirmBtn) {
      this.confirmPayment(confirmBtn.getAttribute('data-order-id'));
    } else if (updateBtn) {
      const orderId = updateBtn.getAttribute('data-order-id');
      const nextStatus = updateBtn.getAttribute('data-next-status');
      this.updateOrderStatus(orderId, nextStatus);
    } else if (cancelBtn) {
      const orderId = cancelBtn.getAttribute('data-order-id');
      this.cancelOrder(orderId);
    }
  });

  
  // Sidebar toggle
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
}


  //Applies search and filter functionality
  applyFilters() {
  const searchTerm = document.querySelector('.search-bar').value.toLowerCase();
  const selectedDate = document.getElementById('datePicker').value;
  const selectedPickupDate = document.getElementById('filterPickupDate').value;
  const status = document.getElementById('filterStatus').value.toLowerCase();
  const paymentStatus = document.getElementById('filterPaymentStatus').value.toLowerCase();

  const filteredOrders = this.orders.filter(order => {
    const orderId = `#ORD${order.orderId.toString().padStart(3, '0')}`.toLowerCase();
    const customerName = order.customer_name.toLowerCase();
    const amount = `PHP ${Number(order.total_amount).toFixed(2)}`.toLowerCase();
    const rowOrderDate = order.createdAt.split('T')[0];
    const rowPickupDate = order.pickup_date ? order.pickup_date.split('T')[0] : null;
    const rowStatus = order.status.toLowerCase();
    
    // Calculate payment status based on payment method and verification
    const rowPaymentStatus = order.payment_method === 'cash' ? 
      (order.status === 'delivered' ? 'paid' : 'unpaid') : 
      (order.payment_verified ? 'paid' : 'unpaid');

    // Exact date match: only include orders from the selected date
    const dateMatch = !selectedDate || rowOrderDate === selectedDate;
    const pickupDateMatch = !selectedPickupDate || rowPickupDate === selectedPickupDate;
    const searchMatch = orderId.includes(searchTerm) || customerName.includes(searchTerm) || amount.includes(searchTerm);
    const statusMatch = !status || order.status === status; // ← FIXED: changed status_key to status
    const paymentStatusMatch = !paymentStatus || rowPaymentStatus === paymentStatus;

    return dateMatch && pickupDateMatch && searchMatch && statusMatch && paymentStatusMatch;
  });

  this.renderOrders(filteredOrders);
}
 
  // Confirms payment for an order
  // @param {string} orderId - Order ID
  async confirmPayment(orderId) {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'processing', payment_verified: true })
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      alert(`Payment confirmed for Order #ORD${orderId.toString().padStart(3, '0')}.`);
      this.fetchOrders();
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Failed to confirm payment: ' + error.message);
    }
  }

  // Updates order status
  async updateOrderStatus(orderId, newStatus) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/orders/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    const statusMap = {
      processing: 'In Progress',
      shipped: 'Ready for Delivery', 
      delivered: 'Completed'
    };
    
    alert(`Order #ORD${orderId.toString().padStart(3, '0')} marked as ${statusMap[newStatus] || newStatus}.`);
    this.fetchOrders(); // Refresh the orders
  } catch (error) {
    console.error('Error updating status:', error);
    alert('Failed to update status: ' + error.message);
  }
}

// Cancel order method
async cancelOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this order?')) {
    return;
  }
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/orders/admin/orders/${orderId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'cancelled' })
    });
    const data = await response.json();
    if (!data.success) throw new Error(data.message);
    
    alert(`Order #ORD${orderId.toString().padStart(3, '0')} has been cancelled.`);
    this.fetchOrders(); // Refresh the orders
  } catch (error) {
    console.error('Error cancelling order:', error);
    alert('Failed to cancel order: ' + error.message);
  }
}
}

// Instantiate the manager
const adminOrdersManager = new AdminOrdersManager();