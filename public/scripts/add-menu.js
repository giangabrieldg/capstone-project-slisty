async function fetchMenuItems() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the menu');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    console.log('Token for fetch:', token);
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const menuItems = await response.json();
    if (!response.ok) {
      console.error('Error response:', menuItems);
      alert(`Failed to fetch menu items: ${menuItems.error || menuItems.message || 'Unknown error'}`);
      return;
    }
    if (!Array.isArray(menuItems)) {
      console.error('Expected array, got:', menuItems);
      return;
    }
    const tableBody = document.querySelector('#menuTable tbody');
    tableBody.innerHTML = '';
    menuItems.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${item.category}</td>
        <td><img src="${item.image || 'https://via.placeholder.com/50'}" alt="${item.name}" class="menu-image enlarge-image"></td>
        <td>${item.price}</td>
        <td>${item.description || ''}</td>
        <td>${item.sizes || '-'}</td>
        <td>
          <button class="btn btn-warning btn-sm edit-item" data-id="${item.menuId}">Edit</button>
          <button class="btn btn-danger btn-sm remove-item" data-id="${item.menuId}">Remove</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

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
    console.error('Error fetching menu items:', error.message);
    alert('Error fetching menu items: Network or server issue');
  }
}

async function addMenuItem() {
  const token = localStorage.getItem('token');
  console.log('Token for add:', token);
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  const form = document.getElementById('itemForm');
  const formData = new FormData(form);
  console.log('FormData entries:', [...formData.entries()]);
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (response.ok) {
      form.reset();
      document.getElementById('imageUpload').value = '';
      bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
      fetchMenuItems();
      alert(`Item "${formData.get('itemName')}" added successfully!`);
    } else {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      alert(`Failed to add menu item: ${errorData.error || errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error adding menu item:', error.message);
    alert('Error adding menu item: Network or server issue');
  }
}

async function updateMenuItem() {
  const menuId = document.getElementById('editItemId').value;
  const token = localStorage.getItem('token');
  console.log('Token for update:', token);
  if (!token) {
    alert('Please log in to update a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  const form = document.getElementById('itemForm');
  const formData = new FormData(form);
  console.log('FormData entries:', [...formData.entries()]);
  try {
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    if (response.ok) {
      form.reset();
      document.getElementById('imageUpload').value = '';
      bootstrap.Modal.getInstance(document.getElementById('itemModal')).hide();
      fetchMenuItems();
      alert(`Item "${formData.get('itemName')}" updated successfully!`);
    } else {
      const errorData = await response.json();
      console.error('Error response:', errorData);
      alert(`Failed to update menu item: ${errorData.error || errorData.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error updating menu item:', error.message);
    alert('Error updating menu item: Network or server issue');
  }
}

async function deleteMenuItem(menuId) {
  if (confirm(`Are you sure you want to remove this item?`)) {
    const token = localStorage.getItem('token');
    console.log('Token for delete:', token);
    if (!token) {
      alert('Please log in to delete a menu item');
      window.location.href = '/public/login.html';
      return;
    }
    try {
      const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        fetchMenuItems();
        alert('Item removed successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to remove menu item: ${errorData.error || errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting menu item:', error.message);
      alert('Error deleting menu item: Network or server issue');
    }
  }
}

async function openEditModal(menuId) {
  const token = localStorage.getItem('token');
  console.log('Token for edit:', token);
  if (!token) {
    alert('Please log in to edit a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch(`http://localhost:3000/api/menu/${menuId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const item = await response.json();
    if (!response.ok) {
      console.error('Error response:', item);
      alert(`Failed to fetch menu item: ${item.error || item.message || 'Unknown error'}`);
      return;
    }
    document.getElementById('itemModalLabel').textContent = 'Edit Menu Item';
    document.getElementById('editItemId').value = item.menuId;
    document.getElementById('itemName').value = item.name;
    document.getElementById('category').value = item.category;
    document.getElementById('price').value = item.price;
    document.getElementById('description').value = item.description || '';
    document.getElementById('sizes').value = item.sizes || '';
    document.getElementById('imageUpload').value = '';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
  } catch (error) {
    console.error('Error fetching item for edit:', error.message);
    alert('Error fetching item for edit: Network or server issue');
  }
}

document.querySelector('.search-bar').addEventListener('input', async (e) => {
  const searchTerm = e.target.value.toLowerCase();
  const token = localStorage.getItem('token');
  console.log('Token for search:', token);
  if (!token) {
    alert('Please log in to search menu items');
    window.location.href = '/public/login.html';
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    const menuItems = await response.json();
    if (!response.ok) {
      console.error('Error response:', menuItems);
      alert(`Failed to search menu items: ${menuItems.error || menuItems.message || 'Unknown error'}`);
      return;
    }
    const tableBody = document.querySelector('#menuTable tbody');
    tableBody.innerHTML = '';
    menuItems
      .filter(item => item.name.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm))
      .forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${item.name}</td>
          <td>${item.category}</td>
          <td><img src="${item.image || 'https://via.placeholder.com/50'}" alt="${item.name}" class="menu-image enlarge-image"></td>
          <td>${item.price}</td>
          <td>${item.description || ''}</td>
          <td>${item.sizes || '-'}</td>
          <td>
            <button class="btn btn-warning btn-sm edit-item" data-id="${item.menuId}">Edit</button>
            <button class="btn btn-danger btn-sm remove-item" data-id="${item.menuId}">Remove</button>
          </td>
        `;
        tableBody.appendChild(row);
      });
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
    console.error('Error searching menu items:', error.message);
    alert('Error searching menu items: Network or server issue');
  }
});

document.querySelector('.sidebar-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('show');
  document.body.classList.toggle('sidebar-visible');
});

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

document.querySelector('.add-item-btn').addEventListener('click', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add a menu item');
    window.location.href = '/public/login.html';
    return;
  }
  document.getElementById('itemModalLabel').textContent = 'Add New Menu Item';
  document.getElementById('editItemId').value = '';
  document.getElementById('itemForm').reset();
  document.getElementById('imageUpload').value = '';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('itemModal')).show();
});

document.getElementById('itemForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (document.getElementById('editItemId').value) {
    updateMenuItem();
  } else {
    addMenuItem();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to access the admin panel');
    window.location.href = '/public/login.html';
    return;
  }
  fetchMenuItems();
});