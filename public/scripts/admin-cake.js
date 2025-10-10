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
        
        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${displayOrderId}</td>
          <td>${order.customer ? order.customer.name : 'Unknown'}</td>
          <td>${details}</td>
          <td>${deliveryDate}</td>
          <td>
            ${order.referenceImageUrl ? `<a href="#" class="view-image" data-image-url="${order.referenceImageUrl}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>
            ${order.designImageUrl ? `<a href="#" class="view-image" data-image-url="${order.designImageUrl}" data-image-type="design" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>${renderStatusBadge(order.status)}</td>
          <td>${renderPriceInfo(order)}</td>
          <td>${paymentInfo}</td>
          <td>
            <div class="admin-actions">
              ${renderStatusDropdown(order.customCakeId, false, order.status)}
              ${renderPriceInput(order, false)}
              <button class="btn btn-primary btn-sm update-status mt-1">Update Status</button>
            </div>
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
        
        // Enhanced payment information display
        const paymentInfo = renderPaymentInfo(order);
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${displayOrderId}</td>
          <td>${order.customer ? order.customer.name : 'Unknown'}</td>
          <td>${order.flavor}</td>
          <td>${order.size || 'Not specified'}</td>
          <td>${order.message || 'None'}</td>
          <td>${new Date(order.eventDate).toLocaleDateString()}</td>
          <td>${deliveryDate}</td>
          <td>${order.notes || 'None'}</td>
          <td>
            ${order.imagePath ? `<a href="#" class="view-image" data-image-url="${order.imagePath}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>${renderStatusBadge(order.status)}</td>
          <td>${renderPriceInfo(order)}</td>
          <td>${paymentInfo}</td>
          <td>
            <div class="admin-actions">
              ${renderStatusDropdown(orderId, true, order.status)}
              ${renderPriceInput(order, true)}
              <button class="btn btn-primary btn-sm update-status">Update</button>
            </div>
          </td>
        `;
        imageTbody.appendChild(row);
      });
    }

    if (!customData.orders || customData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="10" class="text-center">No custom cake orders found</td>`;
      customTbody.appendChild(row);
    }

    if (!imageData.orders || imageData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="13" class="text-center">No image-based orders found</td>`;
      imageTbody.appendChild(row);
    }

    setupEventListeners(token);
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    alert(`Failed to load orders: ${error.message}`);
  }
}

// Helper function to render price information
// Fixed renderPaymentInfo with proper null checks for admin interface
function renderPaymentInfo(order) {
  const paymentMethod = order.payment_status === 'paid' ? 'GCash' : 
                       order.payment_status === 'pending' ? 'Cash' : 'Not set';
  
  let html = `<div class="payment-info-container">`;
  
  // Payment method badge
  html += `<div class="mb-1">
    <span class="badge ${order.payment_status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}">
      ${paymentMethod}
    </span>
  </div>`;
  
  // Downpayment status - FIXED with null checks
  if (order.is_downpayment_paid === true) {
    const downpaymentAmount = parseFloat(order.downpayment_amount) || 0;
    const remainingBalance = parseFloat(order.remaining_balance) || 0;
    
    html += `
      <div class="downpayment-status mb-2">
        <span class="badge bg-info">
          <i class="fas fa-check-circle"></i> Downpayment Paid
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
      ? '<span class="badge bg-success"><i class="fas fa-check-double"></i> Fully Paid</span>'
      : '<span class="badge bg-warning text-dark"><i class="fas fa-clock"></i> Balance Due</span>';
    html += `<div>${finalPaymentBadge}</div>`;
  } else {
    // No downpayment yet
    const statusBadge = order.payment_status === 'paid' 
      ? '<span class="badge bg-success">Paid</span>'
      : '<span class="badge bg-secondary">Awaiting Payment</span>';
    html += `<div>${statusBadge}</div>`;
  }
  
  html += `</div>`;
  return html;
}

// Fixed renderPriceInfo with proper null checks
function renderPriceInfo(order) {
  if (!order.price) {
    return '<span class="badge bg-secondary">Price Not Set</span>';
  }
  
  let html = `<div class="price-info">`;
  html += `<div class="fw-bold">₱${parseFloat(order.price).toFixed(2)}</div>`;
  
  // FIXED: Check if downpayment fields exist and are not null
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

// Helper function to render status badge with icons
function renderStatusBadge(status) {
  const statusConfig = {
    'Pending Review': { class: 'bg-secondary', icon: 'fa-clock' },
    'Ready for Downpayment': { class: 'bg-primary', icon: 'fa-dollar-sign' },
    'Downpayment Paid': { class: 'bg-info', icon: 'fa-check-circle' },
    'In Progress': { class: 'bg-warning text-dark', icon: 'fa-cog' },
    'Ready for Pickup/Delivery': { class: 'bg-success', icon: 'fa-box' },
    'Completed': { class: 'bg-success', icon: 'fa-check-double' },
    'Cancelled': { class: 'bg-danger', icon: 'fa-times-circle' },
    'Feasible': { class: 'bg-primary', icon: 'fa-thumbs-up' },
    'Not Feasible': { class: 'bg-danger', icon: 'fa-thumbs-down' }
  };
  
  const config = statusConfig[status] || { class: 'bg-secondary', icon: 'fa-question' };
  return `<span class="badge ${config.class}"><i class="fas ${config.icon}"></i> ${status}</span>`;
}

// Helper function to render status dropdown
function renderStatusDropdown(orderId, isImageOrder, currentStatus) {
  const baseStatuses = [
    'Pending Review',
    'Ready for Downpayment',
    'Downpayment Paid',
    'In Progress',
    'Ready for Pickup/Delivery',
    'Completed',
    'Cancelled'
  ];
  
  const imageStatuses = isImageOrder 
    ? ['Pending Review', 'Feasible', 'Ready for Downpayment', 'Downpayment Paid', 'Not Feasible', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled']
    : baseStatuses;
  
  let html = `<select class="form-select status-select mb-2" data-order-id="${orderId}" data-is-image-order="${isImageOrder}">`;
  
  imageStatuses.forEach(status => {
    html += `<option value="${status}" ${currentStatus === status ? 'selected' : ''}>${status}</option>`;
  });
  
  html += `</select>`;
  return html;
}

// Helper function to render price input
function renderPriceInput(order, isImageOrder) {
  const showStatuses = isImageOrder 
    ? ['Pending Review', 'Feasible', 'Ready for Downpayment']
    : ['Pending Review', 'Ready for Downpayment'];
  
  const shouldShow = showStatuses.includes(order.status);
  const isDisabled = order.status === 'Not Feasible' || order.status === 'Cancelled';
  
  return `
    <div class="price-input mb-2" style="display: ${shouldShow ? 'block' : 'none'}">
      <label class="form-label small">Total Price:</label>
      <input 
        type="number" 
        class="form-control form-control-sm price-input-field" 
        placeholder="Enter total price" 
        value="${order.price || ''}" 
        step="0.01" 
        min="0"
        ${isDisabled ? 'disabled' : ''}
      >
      ${order.price ? `
        <small class="text-muted d-block mt-1">
          <i class="fas fa-info-circle"></i> 50% = ₱${(order.price * 0.5).toFixed(2)}
        </small>
      ` : ''}
    </div>`;
}

function setupEventListeners(token) {
  // Image modal handler
  document.querySelectorAll('.view-image').forEach(link => {
    link.addEventListener('click', () => {
      const modalImage = document.querySelector('#imageModal img');
      const modalTitle = document.querySelector('#imageModal .modal-title');
      const imageType = link.dataset.imageType;
      
      modalImage.src = link.dataset.imageUrl;
      modalTitle.textContent = imageType === 'design' ? '3D Design Image' : 'Reference Image';
    });
  });

  // Status update handler
  document.querySelectorAll('.update-status').forEach(button => {
    button.addEventListener('click', async function () {
      const row = this.closest('tr');
      const select = row.querySelector('.status-select');
      const orderId = select.dataset.orderId;
      const isImageOrder = select.dataset.isImageOrder === 'true';
      const newStatus = select.value;

      try {
        let endpoint, body;
        const priceInput = row.querySelector('.price-input-field');
        const price = priceInput ? parseFloat(priceInput.value) : null;

        // Validate price for statuses that require it
        if (['Feasible', 'Ready for Downpayment'].includes(newStatus) && (!price || isNaN(price) || price <= 0)) {
          alert('Please enter a valid price (greater than 0) when setting this status.');
          return;
        }

        if (isImageOrder) {
          // Image-based order logic
          if (newStatus === 'Feasible' || newStatus === 'Ready for Downpayment') {
            endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/image-orders/${orderId}/price`;
            body = { 
              price: price, 
              status: newStatus,
              downpayment_amount: price * 0.5,
              remaining_balance: price * 0.5
            };
          } else {
            endpoint = `${window.API_BASE_URL}/api/custom-cake/image-orders/${orderId}`;
            body = { status: newStatus };
          }
        } else {
          // 3D custom cake logic
          if (newStatus === 'Ready for Downpayment' && price) {
            endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}/price`;
            body = { 
              price: price, 
              status: newStatus,
              downpayment_amount: price * 0.5,
              remaining_balance: price * 0.5
            };
          } else {
            endpoint = `${window.API_BASE_URL}/api/custom-cake/admin/orders/${orderId}`;
            body = { status: newStatus };
          }
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
          // Show success message
          showNotification('success', `Order ${orderId} updated successfully!`);
          
          // Refresh the table
          fetchCustomCakeOrders();
        } else {
          throw new Error(data.message || 'Failed to update order');
        }
      } catch (error) {
        console.error('Error updating order:', error);
        showNotification('error', `Failed to update order: ${error.message}`);
      }
    });
  });

  // Show/hide price input based on status selection
  document.querySelectorAll('.status-select').forEach(select => {
    select.addEventListener('change', function() {
      const row = this.closest('tr');
      const priceInputDiv = row.querySelector('.price-input');
      const priceInput = row.querySelector('.price-input-field');
      const isImageOrder = this.dataset.isImageOrder === 'true';
      
      const showPriceStatuses = isImageOrder ? 
        ['Pending Review', 'Feasible', 'Ready for Downpayment'] : 
        ['Pending Review', 'Ready for Downpayment'];
      
      if (showPriceStatuses.includes(this.value)) {
        priceInputDiv.style.display = 'block';
        priceInput.disabled = false;
      } else if (this.value === 'Not Feasible' || this.value === 'Cancelled') {
        priceInputDiv.style.display = 'block';
        priceInput.disabled = true;
        priceInput.value = '';
      } else {
        priceInputDiv.style.display = 'none';
      }
    });
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
        const statusBadge = row.querySelector('.badge');
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