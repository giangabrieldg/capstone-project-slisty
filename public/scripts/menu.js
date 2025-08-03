// Wait for dynamic HTML includes (navbar, footer) to load before initializing
function waitForIncludes(callback) {
  const checkIncludes = () => {
    const includes = document.querySelectorAll('[data-include-html]');
    if (includes.length === 0 || Array.from(includes).every(el => el.innerHTML.trim() !== '')) {
      callback();
    } else {
      setTimeout(checkIncludes, 100);
    }
  };
  checkIncludes();
}

// Fetch and display all menu items on the customer menu page
async function fetchMenuItems() {
  try {
    const response = await fetch('http://localhost:3000/api/menu');
    const menuItems = await response.json();
    if (!response.ok) {
      document.getElementById('menuItems').innerHTML = `<p>Failed to load menu items: ${menuItems.error || 'Server error'}</p>`;
      return;
    }
    const menuItemsContainer = document.getElementById('menuItems');
    if (!menuItemsContainer) {
      document.body.innerHTML += '<p>Error: Menu container not found.</p>';
      return;
    }
    menuItemsContainer.innerHTML = '';
    if (menuItems.length === 0) {
      menuItemsContainer.innerHTML = '<p>No menu items available.</p>';
      return;
    }
    menuItems.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-12 col-sm-6 col-lg-4';
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
      const stockDisplay = item.stock != null && item.stock > 0 ? item.stock : 'Out of Stock';
      const viewDetailsClass = item.stock != null && item.stock > 0 ? 'btn btn-primary' : 'btn btn-primary disabled';
      const rowHtml = `
        <div class="card mb-4 shadow-sm">
          <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name || 'Unknown'}">
          <div class="card-body">
            <h5 class="card-title">${item.name || 'Unknown Item'}</h5>
            <p class="card-text">${item.description || 'No description available'}</p>
            <p class="card-text"><strong>Price: ${priceDisplay}</strong></p>
            <p class="card-text"><strong>Stock: ${stockDisplay}</strong></p>
            <a href="/public/customer/products.html?id=${item.menuId || ''}" class="${viewDetailsClass}">View Details</a>
          </div>
        </div>
      `;
      col.innerHTML = rowHtml;
      menuItemsContainer.appendChild(col);
    });
  } catch (error) {
    console.error('Error fetching menu items:', error.message);
    document.getElementById('menuItems').innerHTML = '<p>Error loading menu items. Please try again later.</p>';
  }
}

// Search functionality
function setupSearch() {
  const searchInput = document.querySelector('.search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    try {
      const response = await fetch('http://localhost:3000/api/menu');
      const menuItems = await response.json();
      if (!response.ok) {
        document.getElementById('menuItems').innerHTML = `<p>Failed to load menu items: ${menuItems.error || 'Server error'}</p>`;
        return;
      }
      const menuItemsContainer = document.getElementById('menuItems');
      menuItemsContainer.innerHTML = '';
      const filteredItems = menuItems.filter(
        item => (item.name || '').toLowerCase().includes(searchTerm) || (item.category || '').toLowerCase().includes(searchTerm)
      );
      if (filteredItems.length === 0) {
        menuItemsContainer.innerHTML = '<p>No items match your search.</p>';
        return;
      }
      filteredItems.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-lg-4';
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
        const stockDisplay = item.stock != null && item.stock > 0 ? item.stock : 'Out of Stock';
        const viewDetailsClass = item.stock != null && item.stock > 0 ? 'btn btn-primary' : 'btn btn-primary disabled';
        const rowHtml = `
          <div class="card mb-4 shadow-sm">
            <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name || 'Unknown'}">
            <div class="card-body">
              <h5 class="card-title">${item.name || 'Unknown Item'}</h5>
              <p class="card-text">${item.description || 'No description available'}</p>
              <p class="card-text"><strong>Price: ${priceDisplay}</strong></p>
              <p class="card-text"><strong>Stock: ${stockDisplay}</strong></p>
              <a href="/public/customer/products.html?id=${item.menuId || ''}" class="${viewDetailsClass}">View Details</a>
            </div>
          </div>
        `;
        col.innerHTML = rowHtml;
        menuItemsContainer.appendChild(col);
      });
    } catch (error) {
      document.getElementById('menuItems').innerHTML = '<p>Error loading menu items.</p>';
    }
  });
}

// Sorting
function setupSort() {
  const sortSelect = document.querySelector('.sort-select');
  if (!sortSelect) return;

  sortSelect.addEventListener('change', async (e) => {
    const sortBy = e.target.value;
    try {
      const response = await fetch('http://localhost:3000/api/menu');
      let menuItems = await response.json();
      if (!response.ok) {
        document.getElementById('menuItems').innerHTML = `<p>Failed to load menu items: ${menuItems.error || 'Server error'}</p>`;
        return;
      }
      switch (sortBy) {
        case 'price-asc':
          menuItems.sort((a, b) => {
            const aPrice = a.category === 'Cakes' ? Math.min(...Object.values(JSON.parse(a.price))) : Number(a.price);
            const bPrice = b.category === 'Cakes' ? Math.min(...Object.values(JSON.parse(b.price))) : Number(b.price);
            return aPrice - bPrice;
          });
          break;
        case 'price-desc':
          menuItems.sort((a, b) => {
            const aPrice = a.category === 'Cakes' ? Math.max(...Object.values(JSON.parse(a.price))) : Number(a.price);
            const bPrice = b.category === 'Cakes' ? Math.max(...Object.values(JSON.parse(b.price))) : Number(b.price);
            return bPrice - aPrice;
          });
          break;
        case 'name-asc':
          menuItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'name-desc':
          menuItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
      }
      const menuItemsContainer = document.getElementById('menuItems');
      menuItemsContainer.innerHTML = '';
      if (menuItems.length === 0) {
        menuItemsContainer.innerHTML = '<p>No menu items available.</p>';
        return;
      }
      menuItems.forEach(item => {
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-lg-4';
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
        const stockDisplay = item.stock != null && item.stock > 0 ? item.stock : 'Out of Stock';
        const viewDetailsClass = item.stock != null && item.stock > 0 ? 'btn btn-primary' : 'btn btn-primary disabled';
        const rowHtml = `
          <div class="card mb-4 shadow-sm">
            <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name || 'Unknown'}">
            <div class="card-body">
              <h5 class="card-title">${item.name || 'Unknown Item'}</h5>
              <p class="card-text">${item.description || 'No description available'}</p>
              <p class="card-text"><strong>Price: ${priceDisplay}</strong></p>
              <p class="card-text"><strong>Stock: ${stockDisplay}</strong></p>
              <a href="/public/customer/products.html?id=${item.menuId || ''}" class="${viewDetailsClass}">View Details</a>
            </div>
          </div>
        `;
        col.innerHTML = rowHtml;
        menuItemsContainer.appendChild(col);
      });
    } catch (error) {
      document.getElementById('menuItems').innerHTML = '<p>Error sorting menu items.</p>';
    }
  });
}

// Filter by category
function setupCategoryFilters() {
  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      const selectedCategory = link.getAttribute('data-category');

      // Update active class
      categoryFilters.forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');

      try {
        const response = await fetch('http://localhost:3000/api/menu');
        const menuItems = await response.json();
        if (!response.ok) {
          document.getElementById('menuItems').innerHTML = `<p>Failed to load menu items: ${menuItems.error || 'Server error'}</p>`;
          return;
        }
        const filteredItems = selectedCategory
          ? menuItems.filter(item => item.category === selectedCategory)
          : menuItems;
        const menuItemsContainer = document.getElementById('menuItems');
        menuItemsContainer.innerHTML = '';
        if (filteredItems.length === 0) {
          menuItemsContainer.innerHTML = '<p>No items found in this category.</p>';
          return;
        }
        filteredItems.forEach(item => {
          const col = document.createElement('div');
          col.className = 'col-12 col-sm-6 col-lg-4';
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
          const stockDisplay = item.stock != null && item.stock > 0 ? item.stock : 'Out of Stock';
          const viewDetailsClass = item.stock != null && item.stock > 0 ? 'btn btn-primary' : 'btn btn-primary disabled';
          const rowHtml = `
            <div class="card mb-4 shadow-sm">
              <img src="${item.image || 'https://via.placeholder.com/300'}" class="card-img-top" alt="${item.name || 'Unknown'}">
              <div class="card-body">
                <h5 class="card-title">${item.name || 'Unknown Item'}</h5>
                <p class="card-text">${item.description || 'No description available'}</p>
                <p class="card-text"><strong>Price: ${priceDisplay}</strong></p>
                <p class="card-text"><strong>Stock: ${stockDisplay}</strong></p>
                <a href="/public/customer/products.html?id=${item.menuId || ''}" class="${viewDetailsClass}">View Details</a>
              </div>
            </div>
          `;
          col.innerHTML = rowHtml;
          menuItemsContainer.appendChild(col);
        });
      } catch (error) {
        document.getElementById('menuItems').innerHTML = '<p>Error loading menu items.</p>';
      }
    });
  });

  // Set "All" category active on initial load
  const allCategoryLink = document.querySelector('.category-filter[data-category=""]');
  if (allCategoryLink) {
    allCategoryLink.classList.add('active');
  }
}

// Initialize the menu page
waitForIncludes(() => {
  fetchMenuItems();
  setupSearch();
  setupSort();
  setupCategoryFilters();
});
