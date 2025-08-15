// Fetches menu items from the server and renders them
async function fetchMenuItems() {
  // Retrieve authentication token from localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the menu');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    // Set loading state to indicate data fetching
    setLoadingState(true, 'Loading menu items...');
    // Make API request to fetch menu items with authorization header
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    // Check if response is successful
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch menu items');
    }
    
    // Parse response data and render menu items
    const menuItems = await response.json();
    renderMenuItems(menuItems);
  } catch (error) {
    // Log and display error if fetching fails
    console.error('Error fetching menu items:', error);
    showError('Failed to load menu items', error);
  } finally {
    // Reset loading state after operation completes
    setLoadingState(false);
  }
}

// Renders menu items into the table
function renderMenuItems(menuItems) {
  const tableBody = document.querySelector('#menuTable tbody');
  tableBody.innerHTML = '';

  menuItems.forEach(item => {
    const row = document.createElement('tr');
    const priceDisplay = formatPriceDisplay(item);
    const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
    // Format stock display similar to price
    const stockDisplay = item.hasSizes && item.sizes?.length > 0
      ? item.sizes.map(size => `${size.sizeName} - ${size.stock}`).join('<br>')
      : item.stock != null ? item.stock : '0';
    // Apply text-danger only if stock is 0 (or all size stocks are 0)
    const isOutOfStock = item.hasSizes
      ? item.sizes.every(size => size.stock === 0)
      : item.stock === 0;

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
      <td class="${isOutOfStock ? 'text-danger fw-bold' : ''}">
        ${stockDisplay}
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
  
  addTableEventListeners();
}

// Formats price display for menu items
function formatPriceDisplay(item) {
  // Check if item has multiple sizes
  if (item.hasSizes && item.sizes?.length > 0) {
    // Map sizes to formatted string with prices
    return item.sizes.map(size => 
      `${size.sizeName} - ₱${Number(size.price).toFixed(2)}`
    ).join('<br>');
  }
  // Return base price formatted to two decimal places
  return `₱${Number(item.basePrice || 0).toFixed(2)}`;
}

// Adds event listeners to table buttons and images
function addTableEventListeners() {
  // Add click listeners to edit buttons
  document.querySelectorAll('.edit-item').forEach(button => {
    button.addEventListener('click', () => openEditModal(button.getAttribute('data-id')));
  });
  
  // Add click listeners to delete buttons
  document.querySelectorAll('.remove-item').forEach(button => {
    button.addEventListener('click', () => deleteMenuItem(button.getAttribute('data-id')));
  });
  
  // Add click listeners to enlarge images
  document.querySelectorAll('.enlarge-image').forEach(img => {
    img.addEventListener('click', () => {
      document.getElementById('enlargedImage').src = img.src;
      bootstrap.Modal.getOrCreateInstance(document.getElementById('imageModal')).show();
    });
  });
}

// Adds a new menu item via API
async function addMenuItem(formData, form) {
  // Retrieve authentication token
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    // Set loading state for adding item
    setLoadingState(true, 'Adding item...');
    // Make POST request to add menu item
    const response = await fetch('http://localhost:3000/api/menu', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    // Check response status
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to add menu item');
    }
    
    // Show success message and refresh form
    const responseData = await response.json();
    showSuccess(`Item "${formData.get('name')}" added successfully!`);
    resetFormAndRefresh(form);
  } catch (error) {
    // Handle and display errors
    console.error('Error adding menu item:', error);
    showError('Failed to add menu item', error);
  } finally {
    // Reset loading state
    setLoadingState(false);
  }
}

// Updates an existing menu item
async function updateMenuItem(formData, form) {
  // Get menu item ID and token
  const menuId = document.getElementById('editItemId').value;
  const token = localStorage.getItem('token');
  
  if (!token) {
    alert('Please log in to update a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    // Set loading state for updating
    setLoadingState(true, 'Updating item...');
    // Make PUT request to update menu item
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    // Check response status
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update menu item');
    }
    
    // Show success message and refresh form
    const responseData = await response.json();
    showSuccess(`Item "${formData.get('name')}" updated successfully!`);
    resetFormAndRefresh(form);
  } catch (error) {
    // Handle and display errors
    console.error('Error updating menu item:', error);
    showError('Failed to update menu item', error);
  } finally {
    // Reset loading state
    setLoadingState(false);
  }
}

// Deletes a menu item
async function deleteMenuItem(menuId) {
  // Confirm deletion with user
  if (!confirm('Are you sure you want to remove this item? This action cannot be undone.')) {
    return;
  }
  
  // Retrieve authentication token
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to delete a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    // Set loading state for deletion
    setLoadingState(true, 'Deleting item...');
    // Make DELETE request to remove menu item
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    // Check response status
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete menu item');
    }
    
    // Show success message and refresh menu
    showSuccess('Item removed successfully!');
    fetchMenuItems();
  } catch (error) {
    // Handle and display errors
    console.error('Error deleting menu item:', error);
    showError('Failed to delete menu item', error);
  } finally {
    // Reset loading state
    setLoadingState(false);
  }
}

// Opens the edit modal for a menu item
async function openEditModal(menuId) {
  // Retrieve authentication token
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to edit a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  
  try {
    // Set loading state for fetching item data
    setLoadingState(true, 'Loading item data...');
    // Make GET request to fetch item details
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    // Check response status
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch menu item');
    }
    
    // Populate form and show modal
    const item = await response.json();
    populateEditForm(item);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  } catch (error) {
    // Handle and display errors
    console.error('Error fetching item for edit:', error);
    showError('Failed to load item data', error);
  } finally {
    // Reset loading state
    setLoadingState(false);
  }
}

// Populates the edit form with item data
function populateEditForm(item) {
  document.getElementById('itemModalLabel').textContent = 'Edit Menu Item';
  document.getElementById('editItemId').value = item.menuId;
  document.getElementById('itemName').value = item.name;
  document.getElementById('category').value = item.category;
  document.getElementById('description').value = item.description || '';
  document.getElementById('hasSizes').checked = item.hasSizes;

  // Show/hide inputs and populate sizes if applicable
  showSizeInputs(item.hasSizes);
  if (item.hasSizes) {
    populateSizeInputs(item.sizes || []);
    document.getElementById('price').value = ''; // Clear single price
    document.getElementById('stock').value = ''; // Clear single stock
  } else {
    document.getElementById('price').value = item.basePrice || '';
    document.getElementById('stock').value = item.stock || ''; // Set single stock
  }

  // Display image preview if available
  const imagePreview = document.getElementById('imagePreview');
  if (item.image) {
    imagePreview.src = item.image;
    imagePreview.style.display = 'block';
  } else {
    imagePreview.style.display = 'none';
  }
}

// Toggles visibility of size inputs
function showSizeInputs(show) {
  const sizesContainer = document.getElementById('sizesContainer');
  const singlePriceContainer = document.getElementById('singlePriceContainer');
  const singleStockContainer = document.getElementById('singleStockContainer'); // Add this
  const priceInput = document.getElementById('price');
  const stockInput = document.getElementById('stock'); // Add this

  sizesContainer.style.display = show ? 'block' : 'none';
  singlePriceContainer.style.display = show ? 'none' : 'block';
  singleStockContainer.style.display = show ? 'none' : 'block'; // Toggle stock container
  priceInput.toggleAttribute('required', !show);
  stockInput.toggleAttribute('required', !show); // Toggle stock input required
}

// Populates size inputs for editing
function populateSizeInputs(sizes) {
  // Get size input container
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = ''; // Clear existing inputs
  
  // Create input fields for each size
  sizes.forEach((size, index) => {
    const div = document.createElement('div');
    div.className = 'mb-2 size-price-pair';
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-4">
          <input type="text" class="form-control" 
                 name="size_${index}" value="${size.sizeName}" 
                 placeholder="Size (e.g., Small)" required />
        </div>
        <div class="col-3">
          <input type="number" class="form-control" 
                 name="price_${index}" value="${size.price}" 
                 step="0.01" min="0" placeholder="Price (₱)" required />
        </div>
        <div class="col-3">
          <input type="number" class="form-control" 
                 name="stock_${index}" value="${size.stock}" 
                 min="0" placeholder="Stock" required />
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
  
  // Add listeners for removing sizes
  addRemoveSizeListeners();
}

// Adds event listeners to remove size buttons
function addRemoveSizeListeners() {
  // Add click listeners to remove buttons
  document.querySelectorAll('.remove-size').forEach(button => {
    button.addEventListener('click', (e) => {
      e.target.closest('.size-price-pair').remove();
      reindexSizeInputs();
    });
  });
}

// Reindexes size inputs after removal
function reindexSizeInputs() {
  // Get all size-price pairs
  const pairs = document.querySelectorAll('.size-price-pair');
  // Update input names with new indices
  pairs.forEach((pair, index) => {
    pair.querySelector('input[type="text"]').name = `size_${index}`;
    pair.querySelector('input[type="number"]').name = `price_${index}`;
  });
}

// Clears size-price input pairs
function clearSizePricePairs(initialSize = false) {
  // Get size input container
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = ''; // Clear existing inputs
  
  // Add initial size input if specified
  if (initialSize) {
    const div = document.createElement('div');
    div.className = 'mb-2 size-price-pair';
    div.innerHTML = `
      <div class="row g-2 align-items-center">
        <div class="col-4">
          <input type="text" class="form-control" name="size_0" placeholder="Size (e.g., Small)" required />
        </div>
        <div class="col-3">
          <input type="number" class="form-control" name="price_0" step="0.01" min="0" placeholder="Price (₱)" required />
        </div>
        <div class="col-3">
          <input type="number" class="form-control" name="stock_0" min="0" placeholder="Stock" required />
        </div>
        <div class="col-2">
          <button type="button" class="btn btn-sm btn-danger remove-size w-100">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
    sizePricePairsDiv.appendChild(div);
  }
}

// Resets form and refreshes menu
function resetFormAndRefresh(form) {
  // Reset form fields and UI elements
  form.reset();
  document.getElementById('imageUpload').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('hasSizes').checked = false;
  clearSizeInputs();
  // Hide modal and refresh menu
  bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
  fetchMenuItems();
}

// Clears size inputs and resets to single price
function clearSizeInputs() {
  // Get relevant DOM elements
  const sizesContainer = document.getElementById('sizesContainer');
  const singlePriceContainer = document.getElementById('singlePriceContainer');
  const priceInput = document.getElementById('price');
  if (sizesContainer && singlePriceContainer && priceInput) {
    // Toggle visibility and attributes
    sizesContainer.style.display = 'none';
    singlePriceContainer.style.display = 'block';
    priceInput.setAttribute('required', 'true');
    clearSizePricePairs(false);
  }
}

// Sets loading state for UI elements
function setLoadingState(isLoading, message = '') {
  // Update save button state
  const saveButton = document.getElementById('saveItem');
  if (saveButton) {
    saveButton.disabled = isLoading;
    saveButton.innerHTML = isLoading 
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}`
      : 'Save Item';
  }
  
  // Disable/enable action buttons
  document.querySelectorAll('.edit-item, .remove-item, .add-item-btn').forEach(btn => {
    btn.disabled = isLoading;
  });
}

// Displays success toast notification
function showSuccess(message) {
  // Show toast with success message
  const toast = new bootstrap.Toast(document.getElementById('successToast'));
  const toastMessage = document.getElementById('successToastMessage');
  if (toastMessage) {
    toastMessage.textContent = message;
    toast.show();
  }
}

// Displays error toast notification
function showError(title, error) {
  // Log and show error message
  console.error(title, error);
  const errorToast = new bootstrap.Toast(document.getElementById('errorToast'));
  const errorToastMessage = document.getElementById('errorToastMessage');
  if (errorToastMessage) {
    errorToastMessage.textContent = `${title}: ${error.message || 'Unknown error'}`;
    errorToast.show();
  }
}

// Handles form submission for adding/editing items
function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const hasSizes = formData.get('hasSizes') === 'on';

   // Always include hasSizes in form data
  formData.set('hasSizes', hasSizes.toString());

  // Handle sizes if enabled
  // In handleFormSubmit function:
 if (hasSizes) {
    // For items with sizes, we'll use size-specific stock
    const sizes = [];
    const sizeInputs = document.querySelectorAll('input[name^="size_"]');
    const priceInputs = document.querySelectorAll('input[name^="price_"]');
    const stockInputs = document.querySelectorAll('input[name^="stock_"]');

    // Validate all size inputs
    for (let index = 0; index < sizeInputs.length; index++) {
      const size = sizeInputs[index].value.trim();
      const price = priceInputs[index].value.trim();
      const stock = stockInputs[index].value.trim();
      
      if (!size || !price || isNaN(price) || Number(price) < 0 || 
          !stock || isNaN(stock) || Number(stock) < 0) {
        showError('Validation Error', new Error('Please enter valid sizes, prices and stock for all sizes'));
        return;
      }
      
      sizes.push({ 
        sizeName: size, 
        price: Number(price).toFixed(2),
        stock: parseInt(stock)
      });
      
      // Remove the size inputs from formData since we're sending as JSON
      formData.delete(`size_${index}`);
      formData.delete(`price_${index}`);
      formData.delete(`stock_${index}`);
    }
    
    // Add sizes as JSON string
    formData.set('sizes', JSON.stringify(sizes));
    
    // Remove the main stock field for items with sizes
    formData.delete('stock');
  } else {
    // For items without sizes, validate the single price and stock
    const price = formData.get('price');
    const stock = formData.get('stock');
    
    if (!price || isNaN(price) || Number(price) < 0 ||
        !stock || isNaN(stock) || Number(stock) < 0) {
      showError('Validation Error', new Error('Please enter valid price and stock'));
      return;
    }
    
    // Set base price and ensure we don't send sizes
    formData.set('basePrice', Number(price).toFixed(2));
    formData.delete('price');
    formData.delete('sizes');
  }

  // Determine if editing or adding
   const isEdit = !!document.getElementById('editItemId').value;
  if (isEdit) {
    updateMenuItem(formData, form);
  } else {
    addMenuItem(formData, form);
  }
}

// Initializes page functionality
function initializePage() {
  // Check for authentication token
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the admin panel');
    window.location.href = '/public/login.html';
    return;
  }

  // Verify required DOM elements
  const requiredElements = ['sizesContainer', 'singlePriceContainer', 'imagePreview', 'successToastMessage', 'errorToastMessage', 'hasSizes'];
  for (const id of requiredElements) {
    if (!document.getElementById(id)) {
      console.error(`Element with ID "${id}" not found in DOM`);
      return;
    }
  }

  // Add click listener to add item button
  document.querySelector('.add-item-btn').addEventListener('click', () => {
    // Reset modal and form for adding new item
    document.getElementById('itemModalLabel').textContent = 'Add New Menu Item';
    document.getElementById('editItemId').value = '';
    document.getElementById('itemForm').reset();
    document.getElementById('imageUpload').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('category').value = 'Drinks';
    document.getElementById('stock').value = '';
    document.getElementById('hasSizes').checked = false;
    clearSizeInputs();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  });

  // Add change listener for size toggle
  document.getElementById('hasSizes').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    showSizeInputs(isChecked);
    clearSizePricePairs(isChecked);
  });

  // Add click listener for adding size-price pair
  document.getElementById('addSizePrice').addEventListener('click', () => {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  const index = sizePricePairsDiv.querySelectorAll('.size-price-pair').length;
  const div = document.createElement('div');
  div.className = 'mb-2 size-price-pair';
  div.innerHTML = `
    <div class="row g-2 align-items-center">
      <div class="col-4">
        <input type="text" class="form-control" name="size_${index}" placeholder="Size (e.g., Small)" required />
      </div>
      <div class="col-3">
        <input type="number" class="form-control" name="price_${index}" step="0.01" min="0" placeholder="Price (₱)" required />
      </div>
      <div class="col-3">
        <input type="number" class="form-control" name="stock_${index}" min="0" placeholder="Stock" required />
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

  // Add change listener for image upload
  document.getElementById('imageUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      // Preview uploaded image
      const reader = new FileReader();
      reader.onload = function(event) {
        document.getElementById('imagePreview').src = event.target.result;
        document.getElementById('imagePreview').style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  // Add submit listener for item form
  document.getElementById('itemForm').addEventListener('submit', handleFormSubmit);

  // Add input listener for search functionality
  document.querySelector('.search-bar').addEventListener('input', debounce(async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (!searchTerm) {
      fetchMenuItems();
      return;
    }
    
    try {
      // Fetch and filter menu items based on search term
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
      // Handle and display search errors
      console.error('Error searching menu items:', error);
      showError('Failed to search menu items', error);
    }
  }, 300));

  // Add toggle listener for sidebar
  document.querySelector('.sidebar-toggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('show');
    document.body.classList.toggle('sidebar-visible');
  });

  // Add listener to close sidebar on outside click
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 992 &&
        !document.querySelector('.sidebar').contains(e.target) &&
        !document.querySelector('.sidebar-toggle').contains(e.target) &&
        document.querySelector('.sidebar').classList.contains('show')) {
      document.querySelector('.sidebar').classList.remove('show');
      document.body.classList.remove('sidebar-visible');
    }
  });

  // Initial fetch of menu items
  fetchMenuItems();
}

// Debounces a function to limit execution frequency
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);