// Fetch custom cake orders from backend and populate table
async function fetchCustomCakeOrders() {
  try {
    const response = await fetch('/api/custom-cake/admin/orders', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.message);
    }
    const tbody = document.querySelector('.cake-orders');
    tbody.innerHTML = ''; // Clear existing rows
    data.orders.forEach(order => {
      const flavor = order.cakeColor === '#8B4513' ? 'Chocolate' : 'White';
      const icingStyle = order.icingStyle === 'buttercream' ? 'Buttercream' : 'Whipped';
      const decorations = order.decorations === 'flowers' ? `Flowers (${order.flowerType})` : order.decorations === 'toppings' ? 'Toppings' : order.decorations === 'balloons' ? 'Balloons' : 'None';
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
        <td><span class="status ${order.status.toLowerCase().replace(' ', '-')}" data-order-id="${order.customCakeId}">${order.status}</span></td>
        <td>
          <select class="form-select status-select" data-order-id="${order.customCakeId}">
            <option value="Pending Review" ${order.status === 'Pending Review' ? 'selected' : ''}>Pending Review</option>
            <option value="Feasible" ${order.status === 'Feasible' ? 'selected' : ''}>Feasible</option>
            <option value="Not Feasible" ${order.status === 'Not Feasible' ? 'selected' : ''}>Not Feasible</option>
          </select>
          <button class="btn btn-primary btn-sm update-status">Update</button>
        </td>
      `;
      tbody.appendChild(row);
    });

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

    document.querySelectorAll('.update-status').forEach(button => {
      button.addEventListener('click', async function () {
        const row = this.closest('tr');
        const select = row.querySelector('.status-select');
        const orderId = select.dataset.orderId;
        const newStatus = select.value;
        try {
          const response = await fetch(`/api/custom-cake/admin/orders/${orderId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
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
            throw new Error(data.message);
          }
        } catch (error) {
          console.error('Error updating status:', error);
          alert('Failed to update status');
        }
      });
    });
  } catch (error) {
    console.error('Error fetching custom cake orders:', error);
    alert('Failed to load custom cake orders');
  }
}

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