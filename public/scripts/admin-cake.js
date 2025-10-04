// Fetch custom cake and image-based orders from backend and populate table
async function fetchCustomCakeOrders() {
  try {
    const token = localStorage.getItem('token');
    
    const [customResponse, imageResponse] = await Promise.all([
      fetch('/api/custom-cake/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      }),
      fetch('/api/custom-cake/admin/image-orders', {
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
        
        // ADDED: Get payment method and status
        const paymentMethod = order.payment_status === 'paid' ? 'GCash' : 
                             order.payment_status === 'pending' ? 'Cash' : 'Not set';
        const paymentStatus = order.payment_status || 'pending';
        const paymentBadge = paymentStatus === 'paid' ? 
          '<span class="badge bg-success">Paid</span>' : 
          '<span class="badge bg-warning text-dark">Pending</span>';
        
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
          <td><span class="status ${order.status.toLowerCase().replace(/ /g, '-')}" data-order-id="${order.customCakeId}" data-is-image-order="false">${order.status}</span></td>
          <td>${order.price ? `₱${parseFloat(order.price).toFixed(2)}` : 'Not set'}</td>
          <td>${paymentMethod} ${paymentBadge}</td>
          <td>
            <div class="admin-actions">
              <select class="form-select status-select" data-order-id="${order.customCakeId}" data-is-image-order="false">
                <option value="Pending Review" ${order.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
                <option value="Ready for Checkout" ${order.status === 'Ready for Checkout' ? 'selected' : ''}>Ready for Checkout</option>
                <option value="Pending" ${order.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>Ready</option>
                <option value="In Progress" ${order.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Ready for Pickup/Delivery" ${order.status === 'Ready for Pickup/Delivery' ? 'selected' : ''}>Ready for Pickup/Delivery</option>
                <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
                <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
              <button class="btn btn-primary btn-sm update-status mt-1">Update Status</button>
            </div>
          </td>
        `;
        customTbody.appendChild(row);
      });
    }

    // Process image-based orders
    // In admin-cake.js - FIX the image order ID issue:
// Process image-based orders
// Process image-based orders
if (imageData.success && imageData.orders) {
  imageData.orders.forEach(order => {
    // FIX: Use imageBasedOrderId instead of id
    const orderId = order.imageBasedOrderId || order.id;
    const displayOrderId = `RCC${String(orderId).padStart(3, '0')}`;
    const deliveryDate = order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'Not set';
    
    const paymentMethod = order.payment_status === 'paid' ? 'GCash' : 
                         order.payment_status === 'pending' ? 'Cash' : 'Not set';
    const paymentStatus = order.payment_status || 'pending';
    const paymentBadge = paymentStatus === 'paid' ? 
      '<span class="badge bg-success">Paid</span>' : 
      '<span class="badge bg-warning text-dark">Pending</span>';
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${displayOrderId}</td>
      <td>${order.customer ? order.customer.name : 'Unknown'}</td>
      <td>${order.flavor}</td>
      <td>${order.size || 'Not specified'}</td> <!-- ADD SIZE DISPLAY -->
      <td>${order.message || 'None'}</td>
      <td>${new Date(order.eventDate).toLocaleDateString()}</td>
      <td>${deliveryDate}</td>
      <td>${order.notes || 'None'}</td>
      <td>
        ${order.imagePath ? `<a href="#" class="view-image" data-image-url="${order.imagePath}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
      </td>
      <td><span class="status ${order.status.toLowerCase().replace(/ /g, '-')}" data-order-id="${orderId}" data-is-image-order="true">${order.status}</span></td>
      <td>${order.price ? `₱${parseFloat(order.price).toFixed(2)}` : 'Not set'}</td>
      <td>${paymentMethod} ${paymentBadge}</td>
      <td>
        <div class="admin-actions">
          <select class="form-select status-select mb-2" data-order-id="${orderId}" data-is-image-order="true" id="status-select-${orderId}">
            <option value="Pending Review" ${order.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
            <option value="Feasible" ${order.status === 'Feasible' ? 'selected' : ''}>Feasible</option>
            <option value="Not Feasible" ${order.status === 'Not Feasible' ? 'selected' : ''}>Not Feasible</option>
            ${order.status === 'Feasible' || ['Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled'].includes(order.status) ? `
              <option value="Ready" ${order.status === 'Ready' ? 'selected' : ''}>Ready</option>
              <option value="In Progress" ${order.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Ready for Pickup/Delivery" ${order.status === 'Ready for Pickup/Delivery' ? 'selected' : ''}>Ready for Pickup/Delivery</option>
              <option value="Completed" ${order.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            ` : ''}
          </select>
          <div class="price-input mb-2" style="display: ${order.status === 'Feasible' || ['Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed'].includes(order.status) ? 'block' : 'none'}">
            <input type="number" class="form-control form-control-sm price-input-field" placeholder="Set price" value="${order.price || ''}" step="0.01" min="0" ${order.status === 'Not Feasible' || order.status === 'Cancelled' ? 'disabled' : ''}>
          </div>
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

  // Status update handler for custom cakes (simple status update)
  document.querySelectorAll('.update-status').forEach(button => {
    button.addEventListener('click', async function () {
      const row = this.closest('tr');
      const select = row.querySelector('.status-select');
      const orderId = select.dataset.orderId;
      const isImageOrder = select.dataset.isImageOrder === 'true';
      const newStatus = select.value;

      try {
        let endpoint, body;

        if (isImageOrder) {
          // For image orders - handle different status flows
          const priceInput = row.querySelector('.price-input-field');
          const price = priceInput ? parseFloat(priceInput.value) : null;

          if (newStatus === 'Feasible') {
            if (!price || isNaN(price)) {
              alert('Price is required when marking as Feasible');
              return;
            }
            endpoint = `/api/custom-cake/admin/image-orders/${orderId}/price`;
            body = { price: price, status: newStatus };
          } else if (newStatus === 'Not Feasible') {
            endpoint = `/api/custom-cake/image-orders/${orderId}`;
            body = { status: newStatus };
          } else if (['Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled'].includes(newStatus)) {
            // For progress statuses after Feasible
            endpoint = `/api/custom-cake/image-orders/${orderId}`;
            body = { status: newStatus };
            
            // If updating price in progress statuses
            if (price && !isNaN(price)) {
              endpoint = `/api/custom-cake/admin/image-orders/${orderId}/price`;
              body = { price: price, status: newStatus };
            }
          } else {
            endpoint = `/api/custom-cake/image-orders/${orderId}`;
            body = { status: newStatus };
          }
        } else {
          // For custom cakes - simple status update
          endpoint = `/api/custom-cake/admin/orders/${orderId}`;
          body = { status: newStatus };
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
          const statusSpan = row.querySelector('.status');
          statusSpan.textContent = newStatus;
          statusSpan.className = `status ${newStatus.toLowerCase().replace(/ /g, '-')}`;
          
          // For image orders, update price display if set
          if (isImageOrder && newStatus === 'Feasible') {
            const priceInput = row.querySelector('.price-input-field');
            const priceCell = row.cells[8];
            if (priceCell && priceInput.value) {
              priceCell.textContent = `₱${parseFloat(priceInput.value).toFixed(2)}`;
            }
          }
          
          alert(`Order ${orderId} updated successfully!`);
          fetchCustomCakeOrders(); // Refresh to show updated data
        } else {
          throw new Error(data.message || 'Failed to update order');
        }
      } catch (error) {
        console.error('Error updating order:', error);
        alert(`Failed to update order: ${error.message}`);
      }
    });
  });

  // Show/hide price input for image orders when status changes to Feasible
  document.querySelectorAll('.status-select[data-is-image-order="true"]').forEach(select => {
  select.addEventListener('change', function() {
    const row = this.closest('tr');
    const priceInputDiv = row.querySelector('.price-input');
    const priceInput = row.querySelector('.price-input-field');
    
    if (this.value === 'Feasible' || ['Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed'].includes(this.value)) {
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
}

// Search functionality
document.querySelector('.search-bar').addEventListener('input', (e) => {
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

// Filter functionality - Update filter options
document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('filterStatus').value.toLowerCase().replace(/ /g, '-');
  
  const activeTab = document.querySelector('.tab-pane.active');
  if (activeTab) {
    const tbody = activeTab.querySelector('tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(row => {
        const statusSpan = row.querySelector('.status');
        if (statusSpan) {
          const rowStatus = statusSpan.className.split(' ')[1];
          row.style.display = status === '' || rowStatus === status ? '' : 'none';
        }
      });
    }
  }
  
  const modal = bootstrap.Modal.getInstance(document.getElementById('filterModal'));
  modal.hide();
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