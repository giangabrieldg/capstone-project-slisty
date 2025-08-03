// Fetch and display all menu items in the admin table
async function fetchMenuItems() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the menu');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const menuItems = await response.json();
    if (!response.ok) {
      console.error('Failed to fetch menu items:', menuItems);
      alert(`Failed to fetch menu items: ${menuItems.error || menuItems.message || 'Unknown error'}`);
      return;
    }
    // Clear and populate the table body
    const tableBody = document.querySelector('#menuTable tbody');
    tableBody.innerHTML = '';
    menuItems.forEach(item => {
      const row = document.createElement('tr');
      // Format price for display (JSON for cakes, single price for others)
      let priceDisplay = item.price;
      if (item.category === 'Cakes') {
        try {
          const priceObj = JSON.parse(item.price);
          priceDisplay = Object.entries(priceObj)
            .map(([size, price]) => `${size} - ₱${Number(price).toFixed(2)}`)
            .join(', ');
        } catch {
          priceDisplay = 'Invalid price format';
        }
      } else {
        priceDisplay = `₱${Number(item.price).toFixed(2)}`;
      }
      // Format menu ID as M0001, M0002, etc.
      const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
      
      // Create table row with stock column
      const rowHtml = `
        <td>${formattedMenuId}</td>
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td><img src="${item.image || 'https://via.placeholder.com/50'}" alt="${item.name}" class="menu-image enlarge-image"></td>
        <td>${priceDisplay}</td>
        <td>${item.stock}</td>
        <td>${item.description || ''}</td>
        <td>
          <button class="btn btn-warning btn-sm edit-item" data-id="${item.menuId}">Edit</button>
          <button class="btn btn-danger btn-sm remove-item" data-id="${item.menuId}">Remove</button>
        </td>
      `;
      row.innerHTML = rowHtml;
      tableBody.appendChild(row);
    });
    // Add event listeners for edit, remove, and image enlarge buttons
    document.querySelectorAll('.edit-item').forEach(button => {
      button.addEventListener('click', () => openEditModal(button.getAttribute('data-id')));
    });
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', () => deleteMenuItem(button.getAttribute('data-id')));
    });
    document.querySelectorAll('.enlarge-image').forEach(img => {
      img.addEventListener('click', () => {
        document.getElementById('enlargedImage').src = img.src;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('imageModal')).show();
      });
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    alert('Error fetching menu items: Network or server issue');
  }
}

// Add a new menu item via API
async function addMenuItem(formData, form) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const responseData = await response.json();
    if (response.ok) {
      console.log('Item added successfully:', responseData);
      form.reset();
      document.getElementById('imageUpload').value = '';
      clearSizePricePairs(false);
      bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
      fetchMenuItems();
      alert(`Item "${formData.get('name')}" added successfully!`);
    } else {
      console.error('Failed to add menu item:', responseData);
      alert(`Failed to add menu item: ${responseData.error || responseData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding menu item:', error);
    alert('Error adding menu item: Network or server issue');
  }
}

// Update an existing menu item via API
async function updateMenuItem(formData, form) {
  const menuId = document.getElementById('editItemId').value;
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to update a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const responseData = await response.json();
    if (response.ok) {
      console.log('Item updated successfully:', responseData);
      form.reset();
      document.getElementById('imageUpload').value = '';
      clearSizePricePairs(false);
      bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
      fetchMenuItems();
      alert(`Item "${formData.get('name')}" updated successfully!`);
    } else {
      console.error('Failed to update menu item:', responseData);
      alert(`Failed to update menu item: ${responseData.error || responseData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error updating menu item:', error);
    alert('Error updating menu item: Network or server issue');
  }
}

// Delete a menu item via API (soft delete)
async function deleteMenuItem(menuId) {
  if (confirm(`Are you sure you want to remove this item?`)) {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in to delete a menu item');
      window.location.href = '/public/login.html';
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const responseData = await response.json();
      if (response.ok) {
        console.log('Item deleted successfully:', responseData);
        fetchMenuItems();
        alert('Item removed successfully!');
      } else {
        console.error('Failed to delete menu item:', responseData);
        alert(`Failed to delete menu item: ${responseData.error || responseData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      alert('Error deleting menu item: Network or server issue');
    }
  }
}

// Open the edit modal and populate it with item data
async function openEditModal(menuId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to edit a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const item = await response.json();
    if (!response.ok) {
      console.error('Failed to fetch menu item:', item);
      alert(`Failed to fetch menu item: ${item.error || item.message || 'Unknown error'}`);
      return;
    }
    // Set modal title and form fields
    document.getElementById('itemModalLabel').textContent = 'Edit Menu Item';
    document.getElementById('editItemId').value = item.menuId;
    document.getElementById('itemName').value = item.name;
    document.getElementById('category').value = item.category;
    document.getElementById('stock').value = item.stock; // Populate stock field
    const sizePricePairsDiv = document.getElementById('sizePricePairs');
    sizePricePairsDiv.innerHTML = '';
    const priceInput = document.getElementById('price');
    if (item.category === 'Cakes') {
      // Show size-price inputs for cakes
      document.getElementById('sizesContainer').style.display = 'block';
      document.getElementById('singlePriceContainer').style.display = 'none';
      priceInput.removeAttribute('required');
      let priceObj = {};
      try {
        priceObj = JSON.parse(item.price);
      } catch {
        priceObj = {};
      }
      Object.entries(priceObj).forEach(([size, price], index) => {
        const div = document.createElement('div');
        div.className = 'mb-2 size-price-pair';
        div.innerHTML = `
          <div class="row">
            <div class="col-6">
              <input type="text" class="form-control" name="size_${index}" value="${size}" placeholder="Enter size (e.g., 6\")" required />
            </div>
            <div class="col-6">
              <input type="number" class="form-control" name="price_${index}" step="0.01" min="0" value="${price}" placeholder="Enter price (₱)" required />
            </div>
          </div>
        `;
        sizePricePairsDiv.appendChild(div);
      });
    } else {
      // Show single price input for non-cakes
      document.getElementById('sizesContainer').style.display = 'none';
      document.getElementById('singlePriceContainer').style.display = 'block';
      priceInput.setAttribute('required', 'true');
      sizePricePairsDiv.innerHTML = '';
      document.getElementById('price').value = item.price;
    }
    document.getElementById('description').value = item.description || '';
    document.getElementById('imageUpload').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  } catch (error) {
    console.error('Error fetching item for edit:', error);
    alert('Error fetching item for edit: Network or server issue');
  }
}

// Clear dynamic size-price inputs
function clearSizePricePairs(isCake = false) {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  if (isCake) {
    // Initialize one size-price pair for cakes
    sizePricePairsDiv.innerHTML = `
      <div class="mb-2 size-price-pair">
        <div class="row">
          <div class="col-6">
            <input type="text" class="form-control" name="size_0" placeholder="Enter size (e.g., 6\")" required />
          </div>
          <div class="col-6">
            <input type="number" class="form-control" name="price_0" step="0.01" min="0" placeholder="Enter price (₱)" required />
          </div>
        </div>
      </div>
    `;
  } else {
    // Clear size-price inputs for non-cakes
    sizePricePairsDiv.innerHTML = '';
  }
}

// Handle add new item button click
document.querySelector('.add-item-btn').addEventListener('click', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  // Reset modal for adding new item
  document.getElementById('itemModalLabel').textContent = 'Add New Menu Item';
  document.getElementById('editItemId').value = '';
  document.getElementById('itemForm').reset();
  document.getElementById('imageUpload').value = '';
  document.getElementById('category').value = 'Drinks';
  document.getElementById('stock').value = ''; // Reset stock field
  document.getElementById('sizesContainer').style.display = 'none';
  document.getElementById('singlePriceContainer').style.display = 'block';
  document.getElementById('price').setAttribute('required', 'true');
  clearSizePricePairs(false);
  bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
});

// Toggle size-price inputs based on category
document.getElementById('category').addEventListener('change', (e) => {
  const category = e.target.value;
  const sizesContainer = document.getElementById('sizesContainer');
  const singlePriceContainer = document.getElementById('singlePriceContainer');
  const priceInput = document.getElementById('price');
  if (category === 'Cakes') {
    // Show size-price inputs for cakes
    sizesContainer.style.display = 'block';
    singlePriceContainer.style.display = 'none';
    priceInput.removeAttribute('required');
    clearSizePricePairs(true);
  } else {
    // Show single price input for non-cakes
    sizesContainer.style.display = 'none';
    singlePriceContainer.style.display = 'block';
    priceInput.setAttribute('required', 'true');
    clearSizePricePairs(false);
  }
});

// Add a new size-price input pair for cakes
document.getElementById('addSizePrice').addEventListener('click', () => {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  const index = sizePricePairsDiv.querySelectorAll('.size-price-pair').length;
  const div = document.createElement('div');
  div.className = 'mb-2 size-price-pair';
  div.innerHTML = `
    <div class="row">
      <div class="col-6">
        <input type="text" class="form-control" name="size_${index}" placeholder="Enter size (e.g., 6\")" required />
      </div>
      <div class="col-6">
        <input type="number" class="form-control" name="price_${index}" step="0.01" min="0" placeholder="Enter price (₱)" required />
      </div>
    </div>
  `;
  sizePricePairsDiv.appendChild(div);
});

// Handle form submission for adding or updating items
document.getElementById('itemForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const category = formData.get('category');
  const stock = formData.get('stock');
  console.log('Form data before processing:', Object.fromEntries(formData));
  // Validate stock
  if (!stock || isNaN(stock) || Number(stock) < 0) {
    alert('Please enter a valid stock quantity (non-negative integer).');
    return;
  }
  formData.set('stock', Math.floor(Number(stock))); // Ensure stock is an integer
  if (category === 'Cakes') {
    // Process size-price pairs for cakes
    const priceObj = {};
    let valid = true;
    let index = 0;
    while (formData.get(`size_${index}`)) {
      const size = formData.get(`size_${index}`).trim();
      const price = formData.get(`price_${index}`);
      if (!size || !price || isNaN(price) || Number(price) < 0) {
        valid = false;
        break;
      }
      priceObj[size] = Number(price);
      formData.delete(`size_${index}`);
      formData.delete(`price_${index}`);
      index++;
    }
    if (!valid || Object.keys(priceObj).length === 0) {
      alert('Please enter valid sizes and prices for all cake sizes.');
      return;
    }
    formData.set('price', JSON.stringify(priceObj));
  } else {
    // Validate single price for non-cakes
    const price = formData.get('price');
    if (!price || isNaN(price) || Number(price) < 0) {
      alert('Please enter a valid price.');
      return;
    }
    formData.set('price', Number(price).toFixed(2));
    // Clear size-price inputs for non-cakes
    let index = 0;
    while (formData.get(`size_${index}`)) {
      formData.delete(`size_${index}`);
      formData.delete(`price_${index}`);
      index++;
    }
  }
  console.log('Form data after processing:', Object.fromEntries(formData));
  const isEdit = !!document.getElementById('editItemId').value;
  if (isEdit) {
    updateMenuItem(formData, form);
  } else {
    addMenuItem(formData, form);
  }
});

// Handle search functionality
document.querySelector('.search-bar').addEventListener('input', async (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to search menu items');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const menuItems = await response.json();
    if (!response.ok) {
      console.error('Failed to search menu items:', menuItems);
      alert(`Failed to search menu items: ${menuItems.error || menuItems.message || 'Unknown error'}`);
      return;
    }
    // Filter and display search results
    const tableBody = document.querySelector('#menuTable tbody');
    tableBody.innerHTML = '';
    menuItems
      .filter(item => {
        // Format menu ID as M0001, M0002, etc.
        const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
        return item.name.toLowerCase().includes(searchTerm) || 
               item.category.toLowerCase().includes(searchTerm) ||
               formattedMenuId.toLowerCase().includes(searchTerm);
      })
      .forEach(item => {
        const row = document.createElement('tr');
        let priceDisplay = item.price;
        if (item.category === 'Cakes') {
          try {
            const priceObj = JSON.parse(item.price);
            priceDisplay = Object.entries(priceObj)
              .map(([size, price]) => `${size} - ₱${Number(price).toFixed(2)}`)
              .join(', ');
          } catch {
            priceDisplay = 'Invalid price format';
          }
        } else {
          priceDisplay = `₱${Number(item.price).toFixed(2)}`;
        }
        // Format menu ID as M0001, M0002, etc.
        const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
        
        const rowHtml = `
          <td>${formattedMenuId}</td>
          <td>${item.name}</td>
          <td>${item.category}</td>
          <td><img src="${item.image || 'https://via.placeholder.com/50'}" alt="${item.name}" class="menu-image enlarge-image"></td>
          <td>${priceDisplay}</td>
          <td>${item.stock}</td>
          <td>${item.description || ''}</td>
          <td>
            <button class="btn btn-warning btn-sm edit-item" data-id="${item.menuId}">Edit</button>
            <button class="btn btn-danger btn-sm remove-item" data-id="${item.menuId}">Remove</button>
          </td>
        `;
        row.innerHTML = rowHtml;
        tableBody.appendChild(row);
      });
    // Re-attach event listeners for buttons
    document.querySelectorAll('.edit-item').forEach(button => {
      button.addEventListener('click', () => openEditModal(button.getAttribute('data-id')));
    });
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', () => deleteMenuItem(button.getAttribute('data-id')));
    });
    document.querySelectorAll('.enlarge-image').forEach(img => {
      img.addEventListener('click', () => {
        document.getElementById('enlargedImage').src = img.src;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('imageModal')).show();
      });
    });
  } catch (error) {
    console.error('Error searching menu items:', error);
    alert('Error searching menu items: Network or server issue');
  }
});

// Toggle sidebar visibility
document.querySelector('.sidebar-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('show');
  document.body.classList.toggle('sidebar-visible');
});

// Close sidebar on outside click for mobile
document.addEventListener('click', (e) => {
  if (
    window.innerWidth <= 992 &&
    !document.querySelector('.sidebar').contains(e.target) &&
    !document.querySelector('.sidebar-toggle').contains(e.target) &&
    document.querySelector('.sidebar').classList.contains('show')
  ) {
    document.querySelector('.sidebar').classList.remove('show');
    document.body.classList.remove('sidebar-visible');
  }
});

// Initialize page with authentication check
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the admin panel');
    window.location.href = '/public/login.html';
    return;
  }
  fetchMenuItems();
});