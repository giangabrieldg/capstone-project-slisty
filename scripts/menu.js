async function fetchMenuItems() {
  try {
    const response = await fetch('http://localhost:3000/api/menu', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, // Optional for public access
      },
    });
    const menuItems = await response.json();
    const menuItemsContainer = document.getElementById('menuItems');
    menuItemsContainer.innerHTML = '';
    menuItems.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4';
      col.innerHTML = `
        <div class="card mb-4 shadow-sm">
          <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name}">
          <div class="card-body">
            <h5 class="card-title">${item.name}</h5>
            <p class="card-text">${item.description || 'No description available'}</p>
            <p class="card-text"><strong>Price: ₱${item.price}</strong>${item.sizes ? ` (${item.sizes})` : ''}</p>
            <a href="/pages/customer/products.html?id=${item.menuId}" class="btn btn-primary">View Details</a>
          </div>
        </div>
      `;
      menuItemsContainer.appendChild(col);
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
  }
}

document.querySelector('.search-input').addEventListener('input', async (e) => {
  const searchTerm = e.target.value.toLowerCase();
  try {
    const response = await fetch('http://localhost:3000/api/menu');
    const menuItems = await response.json();
    const menuItemsContainer = document.getElementById('menuItems');
    menuItemsContainer.innerHTML = '';
    menuItems
      .filter(item => item.name.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm))
      .forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-lg-4';
        col.innerHTML = `
          <div class="card mb-4 shadow-sm">
            <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name}">
            <div class="card-body">
              <h5 class="card-title">${item.name}</h5>
              <p class="card-text">${item.description || 'No description available'}</p>
              <p class="card-text"><strong>Price: ₱${item.price}</strong>${item.sizes ? ` (${item.sizes})` : ''}</p>
              <a href="/pages/customer/products.html?id=${item.menuId}" class="btn btn-primary">View Details</a>
            </div>
          </div>
        `;
        menuItemsContainer.appendChild(col);
      });
  } catch (error) {
    console.error('Error searching menu items:', error);
  }
});

document.querySelector('.sort-select').addEventListener('change', async (e) => {
  const sortBy = e.target.value;
  try {
    const response = await fetch('http://localhost:3000/api/menu');
    let menuItems = await response.json();
    switch (sortBy) {
      case 'price-asc':
        menuItems.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        menuItems.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        menuItems.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        menuItems.sort((a, b) => b.name.localeCompare(a.name));
        break;
    }
    const menuItemsContainer = document.getElementById('menuItems');
    menuItemsContainer.innerHTML = '';
    menuItems.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4';
      col.innerHTML = `
        <div class="card mb-4 shadow-sm">
          <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name}">
          <div class="card-body">
            <h5 class="card-title">${item.name}</h5>
            <p class="card-text">${item.description || 'No description available'}</p>
            <p class="card-text"><strong>Price: ₱${item.price}</strong>${item.sizes ? ` (${item.sizes})` : ''}</p>
            <a href="/pages/customer/products.html?id=${item.menuId}" class="btn btn-primary">View Details</a>
          </div>
        </div>
      `;
      menuItemsContainer.appendChild(col);
    });
  } catch (error) {
    console.error('Error sorting menu items:', error);
  }
});

document.querySelectorAll('.category-filter').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const category = e.target.getAttribute('data-category') || '';
    try {
      const response = await fetch('http://localhost:3000/api/menu');
      const menuItems = await response.json();
      const menuItemsContainer = document.getElementById('menuItems');
      menuItemsContainer.innerHTML = '';
      menuItems
        .filter(item => !category || item.category === category)
        .forEach(item => {
          const col = document.createElement('div');
          col.className = 'col-12 col-sm-6 col-lg-4';
          col.innerHTML = `
            <div class="card mb-4 shadow-sm">
              <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name}">
              <div class="card-body">
                <h5 class="card-title">${item.name}</h5>
                <p class="card-text">${item.description || 'No description available'}</p>
                <p class="card-text"><strong>Price: ₱${item.price}</strong>${item.sizes ? ` (${item.sizes})` : ''}</p>
                <a href="/pages/customer/products.html?id=${item.menuId}" class="btn btn-primary">View Details</a>
              </div>
            </div>
          `;
          menuItemsContainer.appendChild(col);
        });
      document.querySelectorAll('.category-filter').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');
    } catch (error) {
      console.error('Error filtering menu items:', error);
    }
  });
});

document.addEventListener('DOMContentLoaded', fetchMenuItems);
