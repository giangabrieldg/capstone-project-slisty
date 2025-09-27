// Fetch custom cake and image-based orders from backend and populate table
async function fetchCustomCakeOrders() {
  try {
    const token = localStorage.getItem('token');
    console.log('Token:', token ? 'Present' : 'Missing');
    
    const [customResponse, imageResponse] = await Promise.all([
      fetch('/api/custom-cake/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(err => ({ ok: false, statusText: err.message })),
      fetch('/api/custom-cake/admin/image-orders', {
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(err => ({ ok: false, statusText: err.message }))
    ]);

    console.log('Custom Response Status:', customResponse.status, customResponse.ok);
    console.log('Image Response Status:', imageResponse.status, imageResponse.ok);

    let customData = { success: false, orders: [] };
    let imageData = { success: false, orders: [] };

    if (customResponse.ok) {
      customData = await customResponse.json();
      console.log('Custom Orders Data:', customData);
    } else {
      console.error('Error fetching custom orders:', customResponse.statusText);
    }

    if (imageResponse.ok) {
      imageData = await imageResponse.json();
      console.log('Image Orders Data:', imageData);
    } else {
      console.error('Error fetching image-based orders:', imageResponse.statusText);
    }

    // Clear both tables
    const customTbody = document.querySelector('.cake-orders');
    const imageTbody = document.querySelector('.image-orders');
    customTbody.innerHTML = '';
    imageTbody.innerHTML = '';

    console.log('Custom orders count:', customData.orders ? customData.orders.length : 0);
    console.log('Image orders count:', imageData.orders ? imageData.orders.length : 0);

    // Process custom cake orders (3D designs) - for FIRST TAB
    if (customData.success && customData.orders) {
      customData.orders.forEach(order => {
        const flavor = order.cakeColor === '#8B4513' ? 'Chocolate' : 'White';
        const icingStyle = order.icingStyle === 'buttercream' ? 'Buttercream' : 'Whipped';
        const decorations = order.decorations === 'flowers' ? `Flowers (${order.flowerType})` : 
                            order.decorations === 'toppings' ? 'Toppings' : 
                            order.decorations === 'balloons' ? 'Balloons' : 'None';
        const customText = order.messageChoice === 'custom' ? `"${order.customText}"` : 'None';
        const details = `${flavor} cake, ${order.size}, ${icingStyle} icing, ${order.filling} filling, ${order.bottomBorder} bottom border, ${order.topBorder} top border, ${decorations}, ${customText}`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${order.customCakeId}</td>
          <td>${order.customer ? order.customer.name : 'Unknown'}</td>
          <td>${details}</td>
          <td>
            ${order.referenceImageUrl ? `<a href="#" class="view-image" data-image-url="${order.referenceImageUrl}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td>
            ${order.designImageUrl ? `<a href="#" class="view-image" data-image-url="${order.designImageUrl}" data-image-type="design" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td><span class="status ${order.status.toLowerCase().replace(' ', '-')}" data-order-id="${order.customCakeId}" data-is-image-order="false">${order.status}</span></td>
          <td>
            <select class="form-select status-select" data-order-id="${order.customCakeId}" data-is-image-order="false">
              <option value="Pending Review" ${order.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
              <option value="Feasible" ${order.status === 'Feasible' ? 'selected' : ''}>Feasible</option>
              <option value="Not Feasible" ${order.status === 'Not Feasible' ? 'selected' : ''}>Not Feasible</option>
            </select>
            <button class="btn btn-primary btn-sm update-status">Update</button>
          </td>
        `;
        customTbody.appendChild(row);
      });
    }

    // Process image-based orders - for SECOND TAB
    if (imageData.success && imageData.orders) {
      imageData.orders.forEach(order => {
        console.log('Processing image order:', order);
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${order.id}</td>
          <td>${order.customer ? order.customer.name : 'Unknown'}</td>
          <td>${order.flavor}</td>
          <td>${order.message || 'None'}</td>
          <td>${new Date(order.eventDate).toLocaleDateString()}</td>
          <td>${order.notes || 'None'}</td>
          <td>
            ${order.imagePath ? `<a href="#" class="view-image" data-image-url="${order.imagePath}" data-image-type="reference" data-bs-toggle="modal" data-bs-target="#imageModal">View</a>` : 'None'}
          </td>
          <td><span class="status ${order.status.toLowerCase().replace(' ', '-')}" data-order-id="${order.id}" data-is-image-order="true">${order.status}</span></td>
          <td>${order.price ? `$${order.price}` : 'Not set'}</td>
          <td>
            <select class="form-select status-select" data-order-id="${order.id}" data-is-image-order="true">
              <option value="Pending Review" ${order.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
              <option value="Feasible" ${order.status === 'Feasible' ? 'selected' : ''}>Feasible</option>
              <option value="Not Feasible" ${order.status === 'Not Feasible' ? 'selected' : ''}>Not Feasible</option>
            </select>
            <button class="btn btn-primary btn-sm update-status">Update</button>
          </td>
        `;
        imageTbody.appendChild(row);
      });
    }

    // If no orders in either tab, show messages
    if (customData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="7" class="text-center">No custom cake orders found</td>
      `;
      customTbody.appendChild(row);
    }

    if (imageData.orders.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="10" class="text-center">No image-based orders found</td>
      `;
      imageTbody.appendChild(row);
    }

    // Update the image modal handler
    document.querySelectorAll('.view-image').forEach(link => {
      link.addEventListener('click', () => {
        const modalImage = document.querySelector('#imageModal img');
        const modalTitle = document.querySelector('#imageModal .modal-title');
        const imageType = link.dataset.imageType;
        
        modalImage.src = link.dataset.imageUrl;
        modalTitle.textContent = imageType === 'design' ? '3D Design Image' : 'Reference Image';
      });
    });

    // Update status handler - FIXED FOR BOTH TABS
    document.querySelectorAll('.update-status').forEach(button => {
      button.addEventListener('click', async function () {
        const row = this.closest('tr');
        const select = row.querySelector('.status-select');
        const orderId = select.dataset.orderId;
        const isImageOrder = select.dataset.isImageOrder === 'true';
        const newStatus = select.value;

        try {
          const endpoint = isImageOrder 
            ? `/api/custom-cake/image-orders/${orderId}`
            : `/api/custom-cake/admin/orders/${orderId}`;
            
          const response = await fetch(endpoint, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ status: newStatus }),
          });
          
          const data = await response.json();
          if (data.success) {
            const statusSpan = row.querySelector('.status');
            statusSpan.textContent = newStatus;
            statusSpan.className = `status ${newStatus.toLowerCase().replace(' ', '-')}`;
            alert(`Status for Order ${orderId} updated to: ${newStatus}`);
          } else {
            throw new Error(data.message || 'Failed to update status');
          }
        } catch (error) {
          console.error('Error updating status:', error);
          alert(`Failed to update status: ${error.message}`);
        }
      });
    });

    // Show warning if either request failed
    if (!customData.success || !imageData.success) {
      const errorMsg = `Some orders could not be loaded. 
        Custom Orders: ${customData.success ? 'Success' : 'Failed'}
        Image Orders: ${imageData.success ? 'Success' : 'Failed'}`;
      console.warn(errorMsg);
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    alert(`Failed to load orders: ${error.message}`);
  }
}

// Update search functionality to work with both tabs
document.querySelector('.search-bar').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  
  // Search in active tab
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

// Update filter functionality to work with both tabs
document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('filterStatus').value.toLowerCase().replace(' ', '-');
  
  // Filter in active tab
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

// Refresh data when switching tabs
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

// Search functionality
document.querySelector('.search-bar').addEventListener('input', (e) => {
  const searchTerm = e.target.value.toLowerCase();
  document.querySelectorAll('.cake-orders tr').forEach(row => {
    const orderId = row.cells[0].textContent.toLowerCase();
    const customerName = row.cells[1].textContent.toLowerCase();
    row.style.display = orderId.includes(searchTerm) || customerName.includes(searchTerm) ? '' : 'none';
  });
});

// Filter functionality
document.getElementById('filterForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const status = document.getElementById('filterStatus').value.toLowerCase().replace(' ', '-');
  document.querySelectorAll('.cake-orders tr').forEach(row => {
    const rowStatus = row.querySelector('.status').className.split(' ')[1];
    row.style.display = status === '' || rowStatus === status ? '' : 'none';
  });
  const modal = bootstrap.Modal.getInstance(document.getElementById('filterModal'));
  modal.hide();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchCustomCakeOrders();
});