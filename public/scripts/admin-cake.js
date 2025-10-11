// Fetch custom cake and image-based orders from backend and populate table
async function fetchCustomCakeOrders() {
  try {
    const token = localStorage.getItem('token');
    
    const [customResponse, imageResponse] = await Promise.all([
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      fetch(`${window.API_BASE_URL}/api/custom-cake/admin/image-orders`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })
    ]);

    let customData = { success: false, orders: [] };
    let imageData = { success: false, orders: [] };

    if (customResponse.ok) {
      customData = await customResponse.json();
    }

    if (imageResponse.ok) {
      imageData = await imageResponse.json();
    }

    const customTbody = document.querySelector('.cake-orders');
    const imageTbody = document.querySelector('.image-orders');
    customTbody.innerHTML = '';
    imageTbody.innerHTML = '';

    // Process custom cake orders (3D designs)
    if (customData.success && customData.orders) {
      customData.orders.forEach(order => {
        const flavor = order.cakeColor === '#8B4513' ? 'Chocolate' : 'White';
        const icingStyle = order.icingStyle === 'buttercream' ? 'Buttercream' : 'Whipped';
        const decorations = order.decorations === 'flowers' ? `Flowers (${order.flowerType})` : 
                            order.decorations === 'toppings' ? 'Toppings' : 
                            order.decorations === 'balloons' ? 'Balloons' : 'None';
        const customText = order.messageChoice === 'custom' ? `"${order.customText}"` : 'None';
        const details = `${flavor} cake, ${order.size}, ${icingStyle} icing, ${order.filling} filling, ${order.bottomBorder} bottom border, ${order.topBorder} top border, ${decorations}, ${customText}`;
        
        const displayOrderId = `CC${String(order.customCakeId).padStart(3, '0')}`;
        const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not set';
        const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 
                         order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unknown';
        
        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);
        
        // Format customer details with delivery address
        const customerDetails = `
          <div class="customer-info">
            <div class="customer-name fw-bold">${order.customer_name || (order.customer ? order.customer.name : 'Unknown')}</div>
            <div class="customer-contact small text-muted">
              ${order.customer_email || (order.customer ? order.customer.email : 'N/A')}<br>${order.customer_phone || 'N/A'}
            </div>
            <div class="delivery-method small text-muted mt-1">
              <strong>Method:</strong> ${order.delivery_method ? order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1) : 'Pickup'}
            </div>
            ${order.delivery_method === 'delivery' && order.delivery_address ? `
              <div class="delivery-address small text-muted mt-1">
                <strong>Delivery Address:</strong><br>
                ${order.delivery_address}
              </div>
            ` : ''}
          </div>
        `;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${displayOrderId}</td>
          <td>${customerDetails}</td>
          <td>${details}</td>
          <td>${orderDate}</td>
          <td>${deliveryDate}</td>
          <td class="text-center">
            ${order.referenceImageUrl ? `<a href="#" class="view-image" data-image-url="${order.referenceImageUrl}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td class="text-center">
            ${order.designImageUrl ? `<a href="#" class="view-image" data-image-url="${order.designImageUrl}" data-image-type="design" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>${renderStatusBadge(order.status)}</td>
          <td>${renderPriceInfo(order)}</td>
          <td>${paymentInfo}</td>
          <td class="admin-actions-cell">
            ${renderStatusActions(order.customCakeId, false, order.status, order)}
          </td>
        `;
        customTbody.appendChild(row);
      });
    }

    // Process image-based orders
    if (imageData.success && imageData.orders) {
      imageData.orders.forEach(order => {
        const orderId = order.imageBasedOrderId || order.id;
        const displayOrderId = `RCC${String(orderId).padStart(3, '0')}`;
        const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not set';
        const orderDate = order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 
                         order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unknown';
        
        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);
        
        // Format customer details with delivery address
        const customerDetails = `
          <div class="customer-info">
            <div class="customer-name fw-bold">${order.customer_name || (order.customer ? order.customer.name : 'Unknown')}</div>
            <div class="customer-contact small text-muted">
              ${order.customer_email || (order.customer ? order.customer.email : 'N/A')}<br>${order.customer_phone || 'N/A'}
            </div>
            <div class="delivery-method small text-muted mt-1">
              <strong>Method:</strong> ${order.delivery_method ? order.delivery_method.charAt(0).toUpperCase() + order.delivery_method.slice(1) : 'Pickup'}
            </div>
            ${order.delivery_method === 'delivery' && order.delivery_address ? `
              <div class="delivery-address small text-muted mt-1">
                <strong>Delivery Address:</strong><br>
                ${order.delivery_address}
              </div>
            ` : ''}
          </div>
        `;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${displayOrderId}</td>
          <td>${customerDetails}</td>
          <td>${order.flavor}</td>
          <td>${order.size || 'Not specified'}</td>
          <td>${order.message || 'None'}</td>
          <td>${new Date(order.eventDate).toLocaleDateString()}</td>
          <td>${orderDate}</td>
          <td>${deliveryDate}</td>
          <td>${order.notes || 'None'}</td>
          <td class="text-center">
            ${order.imagePath ? `<a href="#" class="view-image" data-image-url="${order.imagePath}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>${renderStatusBadge(order.status)}</td>
          <td>${renderPriceInfo(order)}</td>
          <td>${paymentInfo}</td>
          <td class="admin-actions-cell">
            ${renderStatusActions(orderId, true, order.status, order)}
          </td>
        `;
        imageTbody.appendChild(row);
      });
    }

    if (!customData.orders || customData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="11" class="text-center">No custom cake orders found</td>`;
      customTbody.appendChild(row);
    }

    if (!imageData.orders || imageData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="14" class="text-center">No image-based orders found</td>`;
      imageTbody.appendChild(row);
    }

    setupEventListeners(token);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    alert(`Failed to load orders: ${error.message}`);
  }
}

// Helper function to render price information
function renderPriceInfo(order) {
  if (!order.price) {
    return '<span class="status pending">Price Not Set</span>';
  }
  
  let html = `<div class="price-info">`;
  html += `<div class="fw-bold">₱${parseFloat(order.price).toFixed(2)}</div>`;
  
  const hasDownpaymentData = order.downpayment_amount !== null && 
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
  if (order.status === 'Completed') {
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
    const finalPaymentBadge = order.final_payment_status === 'paid' 
      ? '<span class="status paid">Fully Paid</span>'
      : '<span class="status unpaid">Balance Due</span>';
    html += `<div>${finalPaymentBadge}</div>`;
  } else {
    // No downpayment yet
    const statusBadge = order.payment_status === 'paid' 
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
    'Pending Review': { class: 'pending', text: 'Pending Review' },
    'Ready for Downpayment': { class: 'ready-for-dp', text: 'Ready for Downpayment' },
    'Downpayment Paid': { class: 'dp-paid', text: 'Downpayment Paid' },
    'In Progress': { class: 'in-progress', text: 'In Progress' },
    'Ready for Pickup/Delivery': { class: 'ready', text: 'Ready for Pickup/Delivery' },
    'Completed': { class: 'delivered', text: 'Completed' },
    'Cancelled': { class: 'cancelled', text: 'Cancelled' },
    'Not Feasible': { class: 'cancelled', text: 'Not Feasible' }
  };
  
  const config = statusMap[status] || { class: 'pending', text: status };
  return `<span class="status ${config.class}">${config.text}</span>`;
}

// Helper function to render status actions
function renderStatusActions(orderId, isImageOrder, currentStatus, order) {
  let html = '<div class="admin-actions">';
  
  if (isImageOrder) {
    html += renderImageOrderActions(orderId, currentStatus, order);
  } else {
    html += renderCustomCakeActions(orderId, currentStatus, order);
  }
  
  // Cancel button for active orders
  if (currentStatus !== 'Cancelled' && currentStatus !== 'Completed' && currentStatus !== 'Not Feasible') {
    html += `<button class="btn btn-outline-danger btn-sm cancel-order-btn mt-2" data-order-id="${orderId}" data-is-image-order="${isImageOrder}">
      Cancel Order
    </button>`;
  }
  
  html += '</div>';
  return html;
}

// Image-based order actions
function renderImageOrderActions(orderId, currentStatus, order) {
  let html = '';
  const showPriceInput = ['Pending Review', 'Feasible', 'Ready for Downpayment'].includes(currentStatus);
  
  // Price input for relevant statuses
  if (showPriceInput && currentStatus !== 'Not Feasible') {
    html += `
      <div class="price-input mb-2">
        <label class="form-label small">Total Price:</label>
        <input 
          type="number" 
          class="form-control form-control-sm price-input-field" 
          placeholder="Enter total price" 
          value="${order.price || ''}" 
          step="0.01" 
          min="0"
        >
        ${order.price ? `
          <small class="text-muted d-block mt-1">
            <i class="fas fa-info-circle"></i> 50% = ₱${(order.price * 0.5).toFixed(2)}
          </small>
        ` : ''}
      </div>`;
  }
  
  // Action buttons based on current status
  switch(currentStatus) {
    case 'Pending Review':
      html += `
        <button class="btn btn-success btn-sm mark-feasible mb-2" data-order-id="${orderId}">
          Mark as Feasible
        </button>
        <button class="btn btn-danger btn-sm mark-not-feasible w-100" data-order-id="${orderId}">
          Not Feasible
        </button>`;
      break;
      
    case 'Feasible':
      if (order.price) {
        html += `
          <button class="btn btn-primary btn-sm ready-downpayment w-100" data-order-id="${orderId}">
            Ready for Downpayment
          </button>`;
      } else {
        html += `<small class="text-warning d-block mb-1"><i class="fas fa-exclamation-triangle"></i> Set price first</small>`;
      }
      break;
      
    case 'Ready for Downpayment':
      html += `
        <button class="btn btn-primary btn-sm downpayment-paid w-100" data-order-id="${orderId}">
          Downpayment Paid
        </button>`;
      break;
      
    case 'Downpayment Paid':
      html += `
        <button class="btn btn-primary btn-sm mark-in-progress w-100" data-order-id="${orderId}">
          Mark In Progress
        </button>`;
      break;
      
    case 'In Progress':
      html += `
        <button class="btn btn-primary btn-sm ready-pickup w-100" data-order-id="${orderId}">
          Ready for Pickup/Delivery
        </button>`;
      break;
      
    case 'Ready for Pickup/Delivery':
      html += `
        <button class="btn btn-primary btn-sm mark-completed w-100" data-order-id="${orderId}">
          Mark Completed
        </button>`;
      break;
      
    case 'Not Feasible':
    case 'Cancelled':
    case 'Completed':
      html += `<span class="text-muted small">No further actions</span>`;
      break;
  }
  
  return html;
}

// 3D Custom Cake actions
function renderCustomCakeActions(orderId, currentStatus, order) {
  let html = '';
  const showPriceInput = currentStatus === 'Ready for Downpayment';
  
  // Price input for Ready for Downpayment status
  if (showPriceInput) {
    html += `
      <div class="price-input mb-2">
        <label class="form-label small">Total Price:</label>
        <input 
          type="number" 
          class="form-control form-control-sm price-input-field" 
          placeholder="Enter total price" 
          value="${order.price || ''}" 
          step="0.01" 
          min="0"
        >
        ${order.price ? `
          <small class="text-muted d-block mt-1">
            <i class="fas fa-info-circle"></i> 50% = ₱${(order.price * 0.5).toFixed(2)}
          </small>
        ` : ''}
      </div>`;
  }
  
  // Action buttons based on current status
  switch(currentStatus) {
    case 'Downpayment Paid':
      html += `
        <button class="btn btn-primary btn-sm mark-in-progress w-100" data-order-id="${orderId}">
          Mark In Progress
        </button>`;
      break;
      
    case 'In Progress':
      html += `
        <button class="btn btn-primary btn-sm ready-pickup w-100" data-order-id="${orderId}">
          Ready for Pickup/Delivery
        </button>`;
      break;
      
    case 'Ready for Pickup/Delivery':
      html += `
        <button class="btn btn-primary btn-sm mark-completed w-100" data-order-id="${orderId}">
          Mark Completed
        </button>`;
      break;
      
    case 'Cancelled':
    case 'Completed':
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
  // Image modal handler
  document.querySelectorAll('.view-image').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const modalImage = document.querySelector('#imageModal img');
      const modalTitle = document.querySelector('#imageModal .modal-title');
      const imageType = link.dataset.imageType;
      
      modalImage.src = link.dataset.imageUrl;
      modalTitle.textContent = imageType === 'design' ? '3D Design Image' : 'Reference Image';
    });
  });

  // Status action handlers
  document.addEventListener('click', async function(e) {
    const target = e.target.closest('button');
    if (!target) return;

    const orderId = target.dataset.orderId;
    const isImageOrder = target.dataset.isImageOrder === 'true';
    
    try {
      let endpoint, body, newStatus;
      const row = target.closest('tr');
      const priceInput = row?.querySelector('.price-input-field');
      const price = priceInput ? parseFloat(priceInput.value) : null;

      // Handle different button types
      if (target.classList.contains('mark-feasible')) {
        if (!price || isNaN(price) || price <= 0) {
          alert('Please enter a valid price before marking as feasible.');
          return;
        }
        endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}/price`;
        newStatus = 'Feasible';
        body = { 
          price: price, 
          status: newStatus,
          downpayment_amount: price * 0.5,
          remaining_balance: price * 0.5
        };
      }
      else if (target.classList.contains('mark-not-feasible')) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`;
        newStatus = 'Not Feasible';
        body = { status: newStatus };
      }
      else if (target.classList.contains('ready-downpayment')) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`;
        newStatus = 'Ready for Downpayment';
        body = { status: newStatus };
      }
      else if (target.classList.contains('downpayment-paid')) {
        endpoint = `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`;
        newStatus = 'Downpayment Paid';
        body = { status: newStatus };
      }
      else if (target.classList.contains('mark-in-progress')) {
        endpoint = isImageOrder 
          ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`
          : `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
        newStatus = 'In Progress';
        body = { status: newStatus };
      }
      else if (target.classList.contains('ready-pickup')) {
        endpoint = isImageOrder 
          ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`
          : `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
        newStatus = 'Ready for Pickup/Delivery';
        body = { status: newStatus };
      }
      else if (target.classList.contains('mark-completed')) {
        endpoint = isImageOrder 
          ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`
          : `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
        newStatus = 'Completed';
        body = { status: newStatus };
      }
      else if (target.classList.contains('cancel-order-btn')) {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        endpoint = isImageOrder 
          ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`
          : `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
        newStatus = 'Cancelled';
        body = { status: newStatus };
      } else {
        return;
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      
      const data = await response.json();
      if (data.success) {
        showNotification('success', `Order ${orderId} updated to ${newStatus}!`);
        fetchCustomCakeOrders();
      } else {
        throw new Error(data.message || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      showNotification('error', `Failed to update order: ${error.message}`);
    }
  });

  // Real-time price calculation preview
  document.querySelectorAll('.price-input-field').forEach(input => {
    input.addEventListener('input', function() {
      const price = parseFloat(this.value);
      const row = this.closest('tr');
      const existingPreview = row.querySelector('.downpayment-preview');
      
      if (existingPreview) {
        existingPreview.remove();
      }
      
      if (price && !isNaN(price) && price > 0) {
        const preview = document.createElement('small');
        preview.className = 'text-muted d-block mt-1 downpayment-preview';
        preview.innerHTML = `<i class="fas fa-info-circle"></i> 50% Downpayment = ₱${(price * 0.5).toFixed(2)}`;
        this.parentElement.appendChild(preview);
      }
    });
  });
}

// Notification helper function
function showNotification(type, message) {
  const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  
  const notification = document.createElement('div');
  notification.className = `alert ${alertClass} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
  notification.style.zIndex = '9999';
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
document.querySelector('.search-bar')?.addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  
  const activeTab = document.querySelector('.tab-pane.active');
  if (activeTab) {
    const tbody = activeTab.querySelector('tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const orderId = row.cells[0].textContent.toLowerCase();
        const customerName = row.cells[1].textContent.toLowerCase();
        row.style.display = orderId.includes(searchTerm) || customerName.includes(searchTerm) ? '' : 'none';
      });
    }
  }
});

// Filter functionality
document.getElementById('filterForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('filterStatus').value;
  
  const activeTab = document.querySelector('.tab-pane.active');
  if (activeTab) {
    const tbody = activeTab.querySelector('tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const statusBadge = row.querySelector('.status');
        if (statusBadge) {
          const rowStatus = statusBadge.textContent.trim();
          row.style.display = status === '' || rowStatus.includes(status) ? '' : 'none';
        }
      });
    }
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('filterModal'));
  modal?.hide();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchCustomCakeOrders();
  
  // Refresh data when tab is shown
  const tabEls = document.querySelectorAll('a[data-bs-toggle="tab"]');
  tabEls.forEach(tabEl => {
    tabEl.addEventListener('shown.bs.tab', () => {
      fetchCustomCakeOrders();
    });
  });
});