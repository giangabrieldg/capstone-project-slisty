/**
 * AdminOrdersManager handles fetching, updating, and filtering orders for admin/staff
 */
class AdminOrdersManager {
  constructor() {
    this.orders = [];
    this.init();
  }

  /**
   * Initializes event listeners and fetches orders
   */
  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.fetchUserInfo();
      this.fetchOrders();
      this.setupEventListeners();
    });
  }

  /**
   * Fetches user info to display in sidebar
   */
  async fetchUserInfo() {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('/api/auth/profile', {
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

  /**
   * Fetches orders from backend
   */
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

  /**
   * Renders orders in the table
   * @param {Array} orders - Array of order objects
   */
  renderOrders(orders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    tbody.innerHTML = orders.map(order => {
      const statusMap = {
        pending: 'Pending',
        pending_payment: 'Pending Payment',
        processing: 'In Progress',
        shipped: 'Ready for Delivery',
        delivered: 'Completed',
        cancelled: 'Cancelled'
      };
        
      const paymentStatus = order.payment_verified ? 'paid' : 'unpaid';
      return `
        <tr data-order-date="${order.createdAt.split('T')[0]}">
          <td>#ORD${order.orderId.toString().padStart(3, '0')}</td>
          <td>${order.customer_name} <small>(${order.customer_email})</small></td>
          <td>${order.createdAt.split('T')[0]}</td>
          <td>₱${Number(order.total_amount).toFixed(2)}</td>
          <td><span class="status ${paymentStatus}">${paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}</span></td>
          <td>${order.items.map(item => `${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity}`).join('<br>')}</td>
          <td>${order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1)}</td>
          <td><span class="status ${order.status}">${statusMap[order.status]}</span></td>
          <td>
            ${!order.payment_verified && order.payment_method === 'cash' ? `
              <button class="btn btn-success btn-sm confirm-payment" data-order-id="${order.orderId}">
                Confirm Payment
              </button>
            ` : ''}
            <select class="status-select" data-order-id="${order.orderId}">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="pending_payment" ${order.status === 'pending_payment' ? 'selected' : ''}>Pending Payment</option>
              <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>In Progress</option>
              <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Ready for Delivery</option>
              <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Completed</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
            <button class="update-status-btn" data-order-id="${order.orderId}">Update</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Sets up event listeners for search, filter, and actions
   */
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
    // Export to Excel
    document.getElementById('exportExcel').addEventListener('click', () => {
      let table = document.getElementById('ordersPaymentsTable');
      let filename = `Orders_and_Payments_${new Date().toISOString().slice(0, 10)}.xls`;
      if (table) {
        $(table).table2excel({
          filename: filename,
          exclude: '.no-export',
          preserveColors: true
        });
      }
    });
    // Confirm payment and update status (delegated events)
    document.getElementById('ordersTableBody').addEventListener('click', (e) => {
      if (e.target.classList.contains('confirm-payment')) {
        this.confirmPayment(e.target.getAttribute('data-order-id'));
      } else if (e.target.classList.contains('update-status-btn')) {
        this.updateOrderStatus(e.target.getAttribute('data-order-id'));
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

  /**
   * Applies search and filter functionality
   */
  applyFilters() {
    const searchTerm = document.querySelector('.search-bar').value.toLowerCase();
    const selectedDate = document.getElementById('datePicker').value;
    const status = document.getElementById('filterStatus').value.toLowerCase();
    const paymentStatus = document.getElementById('filterPaymentStatus').value.toLowerCase();

    const filteredOrders = this.orders.filter(order => {
      const orderId = `#ORD${order.orderId.toString().padStart(3, '0')}`.toLowerCase();
      const customerName = order.customer_name.toLowerCase();
      const amount = `₱${Number(order.total_amount).toFixed(2)}`.toLowerCase();
      const rowOrderDate = order.createdAt.split('T')[0];
      const rowStatus = order.status.toLowerCase();
      const rowPaymentStatus = order.payment_verified ? 'paid' : 'unpaid';

      const dateMatch = !selectedDate || rowOrderDate >= selectedDate;
      const searchMatch = orderId.includes(searchTerm) || customerName.includes(searchTerm) || amount.includes(searchTerm);
      const statusMatch = !status || rowStatus === status;
      const paymentStatusMatch = !paymentStatus || rowPaymentStatus === paymentStatus;

      return dateMatch && searchMatch && statusMatch && paymentStatusMatch;
    });

    this.renderOrders(filteredOrders);
  }

  /**
   * Confirms payment for an order
   * @param {string} orderId - Order ID
   */
  async confirmPayment(orderId) {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
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

  /**
   * Updates order status
   * @param {string} orderId - Order ID
   */
  async updateOrderStatus(orderId) {
    const select = document.querySelector(`.status-select[data-order-id="${orderId}"]`);
    const newStatus = select.value;
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
      alert(`Status for Order #ORD${orderId.toString().padStart(3, '0')} updated to ${select.options[select.selectedIndex].text}.`);
      this.fetchOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status: ' + error.message);
    }
  }
}

// Instantiate the manager
const adminOrdersManager = new AdminOrdersManager();