// Fetch and display all menu items in the admin table
async function fetchMenuItems() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the menu');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    setLoadingState(true, 'Loading menu items...');
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch menu items');
    }
    
    const menuItems = await response.json();
    renderMenuItems(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    showError('Failed to load menu items', error);
  } finally {
    setLoadingState(false);
  }
}

// Render menu items to the table
function renderMenuItems(menuItems) {
  const tableBody = document.querySelector('#menuTable tbody');
  tableBody.innerHTML = '';
  
  menuItems.forEach(item => {
    const row = document.createElement('tr');
    const priceDisplay = formatPriceDisplay(item);
    const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
    
    row.innerHTML = `
      <td>${formattedMenuId}</td>
      <td>${item.name}</td>
      <td>${item.category}</td>
      <td>
        <img src="${item.image || 'https://via.placeholder.com/50'}" 
             alt="${item.name}" 
             class="menu-image enlarge-image">
        ${item.image ? `<small class="d-block">${item.image.split('/').pop()}</small>` : ''}
      </td>
      <td>${priceDisplay}</td>
      <td class="${item.stock <= 0 ? 'text-danger fw-bold' : ''}">
        ${item.stock}
      </td>
      <td class="text-truncate" style="max-width: 200px;" title="${item.description || ''}">
        ${item.description || ''}
      </td>
      <td>
        <div class="d-flex gap-2">
          <button class="btn btn-warning btn-sm edit-item" data-id="${item.menuId}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-danger btn-sm remove-item" data-id="${item.menuId}">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  // Add event listeners
  addTableEventListeners();
}

// Format price for display
function formatPriceDisplay(item) {
  if (item.hasSizes && item.sizes?.length > 0) {
    return item.sizes.map(size => 
      `${size.sizeName} - ₱${Number(size.price).toFixed(2)}`
    ).join('<br>');
  }
  return `₱${Number(item.basePrice || 0).toFixed(2)}`;
}

// Add event listeners to table elements
function addTableEventListeners() {
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
    setLoadingState(true, 'Adding item...');
    const response = await fetch('http://localhost:3000/api/menu', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add menu item');
    }
    
    const responseData = await response.json();
    showSuccess(`Item "${formData.get('name')}" added successfully!`);
    resetFormAndRefresh(form);
  } catch (error) {
    console.error('Error adding menu item:', error);
    showError('Failed to add menu item', error);
  } finally {
    setLoadingState(false);
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
    setLoadingState(true, 'Updating item...');
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update menu item');
    }
    
    const responseData = await response.json();
    showSuccess(`Item "${formData.get('name')}" updated successfully!`);
    resetFormAndRefresh(form);
  } catch (error) {
    console.error('Error updating menu item:', error);
    showError('Failed to update menu item', error);
  } finally {
    setLoadingState(false);
  }
}

// Delete a menu item via API (soft delete)
async function deleteMenuItem(menuId) {
  if (!confirm('Are you sure you want to remove this item? This action cannot be undone.')) {
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to delete a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    setLoadingState(true, 'Deleting item...');
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete menu item');
    }
    
    showSuccess('Item removed successfully!');
    fetchMenuItems();
  } catch (error) {
    console.error('Error deleting menu item:', error);
    showError('Failed to delete menu item', error);
  } finally {
    setLoadingState(false);
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
    setLoadingState(true, 'Loading item data...');
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch menu item');
    }
    
    const item = await response.json();
    populateEditForm(item);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  } catch (error) {
    console.error('Error fetching item for edit:', error);
    showError('Failed to load item data', error);
  } finally {
    setLoadingState(false);
  }
}

// Populate the edit form with item data
function populateEditForm(item) {
  document.getElementById('itemModalLabel').textContent = 'Edit Menu Item';
  document.getElementById('editItemId').value = item.menuId;
  document.getElementById('itemName').value = item.name;
  document.getElementById('category').value = item.category;
  document.getElementById('stock').value = item.stock;
  document.getElementById('description').value = item.description || '';
  
  // Handle price display based on item type
  if (item.hasSizes && item.sizes?.length > 0) {
    showSizeInputs(true);
    populateSizeInputs(item.sizes);
  } else {
    showSizeInputs(false);
    document.getElementById('price').value = item.basePrice || '';
  }
  
  // Show current image if exists
  const imagePreview = document.getElementById('imagePreview');
  if (item.image) {
    imagePreview.src = item.image;
    imagePreview.style.display = 'block';
  } else {
    imagePreview.style.display = 'none';
  }
}

// Show/hide size inputs
function showSizeInputs(show) {
  document.getElementById('sizesContainer').style.display = show ? 'block' : 'none';
  document.getElementById('singlePriceContainer').style.display = show ? 'none' : 'block';
  document.getElementById('price').toggleAttribute('required', !show);
}

// Populate size inputs
function populateSizeInputs(sizes) {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = '';
  
  sizes.forEach((size, index) => {
    const div = document.createElement('div');
    div.className = 'mb-2 size-price-pair';
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-5">
          <input type="text" class="form-control" 
                 name="size_${index}" value="${size.sizeName}" 
                 placeholder="Size (e.g., 6\")" required />
        </div>
        <div class="col-5">
          <input type="number" class="form-control" 
                 name="price_${index}" value="${size.price}" 
                 step="0.01" min="0" placeholder="Price (₱)" required />
        </div>
        <div class="col-2">
          <button type="button" class="btn btn-sm btn-danger remove-size w-100">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    sizePricePairsDiv.appendChild(div);
  });
  
  // Add event listeners for remove buttons
  addRemoveSizeListeners();
}

// Add event listeners for remove size buttons
function addRemoveSizeListeners() {
  document.querySelectorAll('.remove-size').forEach(button => {
    button.addEventListener('click', (e) => {
      e.target.closest('.size-price-pair').remove();
      reindexSizeInputs();
    });
  });
}

// Reindex size inputs after removal
function reindexSizeInputs() {
  const pairs = document.querySelectorAll('.size-price-pair');
  pairs.forEach((pair, index) => {
    pair.querySelector('input[type="text"]').name = `size_${index}`;
    pair.querySelector('input[type="number"]').name = `price_${index}`;
  });
}

// Clear size-price inputs
function clearSizePricePairs(initialSize = false) {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = '';
  
  if (initialSize) {
    const div = document.createElement('div');
    div.className = 'mb-2 size-price-pair';
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-5">
          <input type="text" class="form-control" name="size_0" placeholder="Size (e.g., 6\")" required />
        </div>
        <div class="col-5">
          <input type="number" class="form-control" name="price_0" step="0.01" min="0" placeholder="Price (₱)" required />
        </div>
        <div class="col-2">
          <button type="button" class="btn btn-sm btn-danger remove-size w-100" disabled>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    sizePricePairsDiv.appendChild(div);
  }
}

// Reset form and refresh data
function resetFormAndRefresh(form) {
  form.reset();
  document.getElementById('imageUpload').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  clearSizeInputs();
  bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
  fetchMenuItems();
}

// Clear size inputs
function clearSizeInputs() {
  document.getElementById('sizesContainer').style.display = 'none';
  document.getElementById('singlePriceContainer').style.display = 'block';
  document.getElementById('price').setAttribute('required', 'true');
  clearSizePricePairs(false);
}

// Set loading state
function setLoadingState(isLoading, message = '') {
  const saveButton = document.getElementById('saveItem');
  if (saveButton) {
    saveButton.disabled = isLoading;
    saveButton.innerHTML = isLoading 
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}`
      : 'Save Item';
  }
  
  // Disable all action buttons while loading
  document.querySelectorAll('.edit-item, .remove-item, .add-item-btn').forEach(btn => {
    btn.disabled = isLoading;
  });
}

// Show success message
function showSuccess(message) {
  const toast = new bootstrap.Toast(document.getElementById('successToast'));
  document.getElementById('successToastMessage').textContent = message;
  toast.show();
}

// Show error message
function showError(title, error) {
  console.error(title, error);
  const errorToast = new bootstrap.Toast(document.getElementById('errorToast'));
  document.getElementById('errorToastMessage').textContent = `${title}: ${error.message || 'Unknown error'}`;
  errorToast.show();
}

// Handle form submission
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const category = formData.get('category');
  const stock = formData.get('stock');
  const isCake = category === 'Cakes';

  // Validate stock
  if (!stock || isNaN(stock) || stock < 0) {
    showError('Validation Error', new Error('Please enter a valid stock quantity (non-negative number)'));
    return;
  }

  // Set hasSizes flag
  formData.set('hasSizes', isCake.toString());

  if (isCake) {
    // Collect size-price pairs
    const sizes = [];
    let index = 0;
    let hasValidSizes = false;

    while (formData.get(`size_${index}`)) {
      const size = formData.get(`size_${index}`).trim();
      const price = formData.get(`price_${index}`);
      if (!size || !price || isNaN(price) || Number(price) < 0) {
        showError('Validation Error', new Error('Please enter valid sizes and prices for all cake sizes'));
        return;
      }
      sizes.push({ sizeName: size, price: Number(price).toFixed(2) });
      hasValidSizes = true;
      formData.delete(`size_${index}`);
      formData.delete(`price_${index}`);
      index++;
    }

    if (!hasValidSizes) {
      showError('Validation Error', new Error('Please add at least one size for cakes'));
      return;
    }
    formData.set('sizes', JSON.stringify(sizes));
  } else {
    // Validate base price
    const price = formData.get('price');
    if (!price || isNaN(price) || Number(price) < 0) {
      showError('Validation Error', new Error('Please enter a valid price'));
      return;
    }
    formData.set('basePrice', Number(price).toFixed(2));
    formData.delete('price');
  }

  const isEdit = !!document.getElementById('editItemId').value;
  if (isEdit) {
    updateMenuItem(formData, form);
  } else {
    addMenuItem(formData, form);
  }
}

// Initialize the page
function initializePage() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the admin panel');
    window.location.href = '/public/login.html';
    return;
  }

  // Verify critical elements exist
  const requiredElements = ['sizesContainer', 'singlePriceContainer', 'imagePreview', 'successToastMessage', 'errorToastMessage'];
  for (const id of requiredElements) {
    if (!document.getElementById(id)) {
      console.error(`Element with ID "${id}" not found in DOM`);
      return;
    }
  }
  
 // Event listeners
  document.querySelector('.add-item-btn').addEventListener('click', () => {
    document.getElementById('itemModalLabel').textContent = 'Add New Menu Item';
    document.getElementById('editItemId').value = '';
    document.getElementById('itemForm').reset();
    document.getElementById('imageUpload').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('category').value = 'Drinks';
    document.getElementById('stock').value = '';
    clearSizeInputs();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  });
  
  document.getElementById('category').addEventListener('change', (e) => {
    const isCake = e.target.value === 'Cakes';
    showSizeInputs(isCake);
    clearSizePricePairs(isCake);
  });
  
  document.getElementById('addSizePrice').addEventListener('click', () => {
    const sizePricePairsDiv = document.getElementById('sizePricePairs');
    const index = sizePricePairsDiv.querySelectorAll('.size-price-pair').length;
    const div = document.createElement('div');
    div.className = 'mb-2 size-price-pair';
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-5">
          <input type="text" class="form-control" name="size_${index}" placeholder="Size (e.g., 6\")" required />
        </div>
        <div class="col-5">
          <input type="number" class="form-control" name="price_${index}" step="0.01" min="0" placeholder="Price (₱)" required />
        </div>
        <div class="col-2">
          <button type="button" class="btn btn-sm btn-danger remove-size w-100">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    sizePricePairsDiv.appendChild(div);
    addRemoveSizeListeners();
  });
  
  document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('imagePreview').src = event.target.result;
        document.getElementById('imagePreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
  
  document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);
  
  document.querySelector('.search-bar').addEventListener('input', debounce(async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (!searchTerm) {
      fetchMenuItems();
      return;
    }
    
    try {
      const response = await fetch('http://localhost:3000/api/menu', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to search menu items');
      }
      
      const menuItems = await response.json();
      const filteredItems = menuItems.filter(item => {
        const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
        return item.name.toLowerCase().includes(searchTerm) || 
               item.category.toLowerCase().includes(searchTerm) ||
               formattedMenuId.toLowerCase().includes(searchTerm);
      });
      
      renderMenuItems(filteredItems);
    } catch (error) {
      console.error('Error searching menu items:', error);
      showError('Failed to search menu items', error);
    }
  }, 300));
  
  // Initialize sidebar toggle
  document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('show');
    document.body.classList.toggle('sidebar-visible');
  });
  
  // Close sidebar on outside click for mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 &&
        !document.querySelector('.sidebar').contains(e.target) &&
        !document.querySelector('.sidebar-toggle').contains(e.target) &&
        document.querySelector('.sidebar').classList.contains('show')) {
      document.querySelector('.sidebar').classList.remove('show');
      document.body.classList.remove('sidebar-visible');
    }
  });
  
  // Initial data load
  fetchMenuItems();
}

// Debounce function for search input
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);