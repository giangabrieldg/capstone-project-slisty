//admin menu side script (adding, editing, deleting menu items)


async function fetchMenuItems() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the menu');
    window.location.href = '/public/login.html';
    return;
  }

  try {
    setLoadingState(true, 'Loading menu items...');
    const response = await fetch(`${window.API_BASE_URL}/api/menu`, {
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

function renderMenuItems(menuItems) {
  const tableBody = document.querySelector('#menuTable tbody');
  tableBody.innerHTML = '';

  menuItems.forEach(item => {
    const row = document.createElement('tr');
    const priceDisplay = formatPriceDisplay(item);
    const formattedMenuId = `M${item.menuId.toString().padStart(4, '0')}`;
    const stockDisplay = item.hasSizes && item.sizes?.length > 0
      ? item.sizes.map(size => `${size.sizeName} - ${size.stock}`).join('<br>')
      : item.stock != null ? item.stock : '0';
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

function formatPriceDisplay(item) {
  if (item.hasSizes && item.sizes?.length > 0) {
    return item.sizes.map(size => 
      `${size.sizeName} - ₱${Number(size.price).toFixed(2)}`
    ).join('<br>');
  }
  return `₱${Number(item.basePrice || 0).toFixed(2)}`;
}

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

async function addMenuItem(formData, form) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }

  try {
    setLoadingState(true, 'Adding item...');
    const response = await fetch(`${window.API_BASE_URL}/api/menu`, {
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
    const response = await fetch(`${window.API_BASE_URL}/api/menu/${menuId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Server response:', errorData); // Log server error
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
    const response = await fetch(`${window.API_BASE_URL}/api/menu/${menuId}`, {
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

async function openEditModal(menuId) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to edit a menu item');
    window.location.href = '/public/login.html';
    return;
  }

  try {
    setLoadingState(true, 'Loading item data...');
    const response = await fetch(`${window.API_BASE_URL}/api/menu/${menuId}`, {
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

function populateEditForm(item) {
  document.getElementById('itemModalLabel').textContent = 'Edit Menu Item';
  document.getElementById('editItemId').value = item.menuId;
  document.getElementById('itemName').value = item.name;
  document.getElementById('category').value = item.category;
  document.getElementById('description').value = item.description || '';
  document.getElementById('hasSizes').checked = item.hasSizes;

  showSizeInputs(item.hasSizes);
  if (item.hasSizes) {
    populateSizeInputs(item.sizes || []);
    document.getElementById('price').value = '';
    document.getElementById('stock').value = '';
  } else {
    document.getElementById('price').value = item.basePrice || '';
    document.getElementById('stock').value = item.stock || '';
  }

  const imagePreview = document.getElementById('imagePreview');
  if (item.image) {
    imagePreview.src = item.image;
    imagePreview.style.display = 'block';
  } else {
    imagePreview.style.display = 'none';
  }
}

function showSizeInputs(show) {
  const sizesContainer = document.getElementById('sizesContainer');
  const singlePriceContainer = document.getElementById('singlePriceContainer');
  const singleStockContainer = document.getElementById('singleStockContainer');
  const priceInput = document.getElementById('price');
  const stockInput = document.getElementById('stock');

  sizesContainer.style.display = show ? 'block' : 'none';
  singlePriceContainer.style.display = show ? 'none' : 'block';
  singleStockContainer.style.display = show ? 'none' : 'block';

  // Toggle required attributes for single-item inputs
  priceInput.toggleAttribute('required', !show);
  stockInput.toggleAttribute('required', !show);

  // Toggle required attributes for size-based inputs
  const sizeInputs = document.querySelectorAll('#sizesContainer input[name^="size_"], #sizesContainer input[name^="price_"], #sizesContainer input[name^="stock_"]');
  sizeInputs.forEach(input => {
    input.toggleAttribute('required', show);
  });
}

function populateSizeInputs(sizes) {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = '';

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

  addRemoveSizeListeners();
}

function addRemoveSizeListeners() {
  document.querySelectorAll('.remove-size').forEach(button => {
    button.addEventListener('click', (e) => {
      e.target.closest('.size-price-pair').remove();
      reindexSizeInputs();
    });
  });
}

function reindexSizeInputs() {
  const pairs = document.querySelectorAll('.size-price-pair');
  pairs.forEach((pair, index) => {
    const sizeInput = pair.querySelector('input[name^="size_"]');
    const priceInput = pair.querySelector('input[name^="price_"]');
    const stockInput = pair.querySelector('input[name^="stock_"]');
    if (sizeInput) sizeInput.name = `size_${index}`;
    if (priceInput) priceInput.name = `price_${index}`;
    if (stockInput) stockInput.name = `stock_${index}`;
  });
}

function clearSizePricePairs(initialSize = false) {
  const sizePricePairsDiv = document.getElementById('sizePricePairs');
  sizePricePairsDiv.innerHTML = '';

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
    addRemoveSizeListeners();
  }
}

function resetFormAndRefresh(form) {
  form.reset();
  document.getElementById('imageUpload').value = '';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('hasSizes').checked = false;
  clearSizeInputs();
  bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
  fetchMenuItems();
}

function clearSizeInputs() {
  const sizesContainer = document.getElementById('sizesContainer');
  const singlePriceContainer = document.getElementById('singlePriceContainer');
  const singleStockContainer = document.getElementById('singleStockContainer');
  const priceInput = document.getElementById('price');
  const stockInput = document.getElementById('stock');

  if (sizesContainer && singlePriceContainer && singleStockContainer && priceInput && stockInput) {
    sizesContainer.style.display = 'none';
    singlePriceContainer.style.display = 'block';
    singleStockContainer.style.display = 'block';
    priceInput.setAttribute('required', 'true');
    stockInput.setAttribute('required', 'true');
    clearSizePricePairs(false);
  }
}

function setLoadingState(isLoading, message = '') {
  const saveButton = document.getElementById('saveItem');
  if (saveButton) {
    saveButton.disabled = isLoading;
    saveButton.innerHTML = isLoading 
      ? `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${message}`
      : 'Save Item';
  }

  document.querySelectorAll('.edit-item, .remove-item, .add-item-btn').forEach(btn => {
    btn.disabled = isLoading;
  });
}

function showSuccess(message) {
  const toast = new bootstrap.Toast(document.getElementById('successToast'));
  const toastMessage = document.getElementById('successToastMessage');
  if (toastMessage) {
    toastMessage.textContent = message;
    toast.show();
  }
}

function showError(title, error) {
  console.error(title, error);
  const errorToast = new bootstrap.Toast(document.getElementById('errorToast'));
  const errorToastMessage = document.getElementById('errorToastMessage');
  if (errorToastMessage) {
    errorToastMessage.textContent = `${title}: ${error.message || 'Unknown error'}`;
    errorToast.show();
  }
}

function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  const hasSizes = formData.get('hasSizes') === 'on';

  // Always include hasSizes in form data
  formData.set('hasSizes', hasSizes.toString());

  // Handle sizes if enabled
  if (hasSizes) {
    const sizes = [];
    const sizeInputs = document.querySelectorAll('input[name^="size_"]');
    const priceInputs = document.querySelectorAll('input[name^="price_"]');
    const stockInputs = document.querySelectorAll('input[name^="stock_"]');

    // Validate all size inputs
    for (let index = 0; index < sizeInputs.length; index++) {
      const size = sizeInputs[index].value.trim();
      const price = priceInputs[index].value.trim();
      const stock = stockInputs[index].value.trim();

      if (!size || !price || isNaN(price) || Number(price) < 0 || !stock || isNaN(stock) || Number(stock) < 0) {
        showError('Validation Error', new Error('Please enter valid sizes, prices, and stock for all sizes'));
        return;
      }

      sizes.push({
        sizeName: size,
        price: Number(price).toFixed(2),
        stock: parseInt(stock),
      });

      // Remove size inputs from formData since we're sending as JSON
      formData.delete(`size_${index}`);
      formData.delete(`price_${index}`);
      formData.delete(`stock_${index}`);
    }

    // Add sizes as JSON string, or empty array if no sizes
    formData.set('sizes', JSON.stringify(sizes.length > 0 ? sizes : []));
    // Ensure stock and basePrice are not sent when hasSizes is true
    formData.delete('stock');
    formData.delete('basePrice');
    formData.delete('price');
  } else {
    // For items without sizes, validate single price and stock
    const price = formData.get('price');
    const stock = formData.get('stock');

    if (!price || isNaN(price) || Number(price) < 0 || !stock || isNaN(stock) || Number(stock) < 0) {
      showError('Validation Error', new Error('Please enter valid price and stock'));
      return;
    }

    // Set basePrice and stock, remove sizes
    formData.set('basePrice', Number(price).toFixed(2));
    formData.set('stock', parseInt(stock));
    formData.delete('price');
    formData.delete('sizes');
  }

  // Ensure name and category are present
  if (!formData.get('name') || !formData.get('category')) {
    showError('Validation Error', new Error('Name and category are required'));
    return;
  }

  // Log FormData for debugging
  console.log('FormData contents:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }

  const isEdit = !!document.getElementById('editItemId').value;
  if (isEdit) {
    updateMenuItem(formData, form);
  } else {
    addMenuItem(formData, form);
  }
}

function initializePage() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the admin panel');
    window.location.href = '/public/login.html';
    return;
  }

  const requiredElements = ['sizesContainer', 'singlePriceContainer', 'imagePreview', 'successToastMessage', 'errorToastMessage', 'hasSizes'];
  for (const id of requiredElements) {
    if (!document.getElementById(id)) {
      console.error(`Element with ID "${id}" not found in DOM`);
      return;
    }
  }

  document.querySelector('.add-item-btn').addEventListener('click', () => {
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

  document.getElementById('hasSizes').addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    showSizeInputs(isChecked);
    clearSizePricePairs(isChecked);
  });

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
      const response = await fetch(`${window.API_BASE_URL}/api/menu`, {
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

  fetchMenuItems();
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

document.addEventListener('DOMContentLoaded', initializePage);