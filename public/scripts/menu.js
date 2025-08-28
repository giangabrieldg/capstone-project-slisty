// Wait for dynamic HTML includes (navbar, footer) to load
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

// Helper function to render menu items
function renderMenuItems(menuItems, container) {
  container.innerHTML = '';
  if (menuItems.length === 0) {
    container.innerHTML = '<p>No items found in this category.</p>';
    return;
  }
  menuItems.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-lg-4';
    let priceDisplay = item.hasSizes && item.sizes?.length > 0
      ? item.sizes.map(size => `${size.sizeName} - ₱${Number(size.price).toFixed(2)}`).join(', ')
      : `₱${Number(item.basePrice || 0).toFixed(2)}`;
    const stockDisplay = item.hasSizes && item.sizes?.length > 0
      ? item.sizes.map(size => `${size.sizeName}: ${size.stock}`).join(', ')
      : item.stock != null && item.stock > 0 ? item.stock : 'Out of Stock';
    const hasStock = item.hasSizes ? item.sizes.some(size => size.stock > 0) : item.stock > 0;
    const viewDetailsClass = hasStock ? 'btn btn-primary' : 'btn btn-primary disabled';
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
    container.appendChild(col);
  });
}

// Fetch and display all menu items
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
    renderMenuItems(menuItems, menuItemsContainer);
  } catch (error) {
    console.error('Error fetching menu items:', error.message);
    document.getElementById('menuItems').innerHTML = '<p>Error loading menu items. Please try again later.</p>';
  }
}

// Set up search functionality
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
      const filteredItems = menuItems.filter(
        item => (item.name || '').toLowerCase().includes(searchTerm) || (item.category || '').toLowerCase().includes(searchTerm)
      );
      renderMenuItems(filteredItems, menuItemsContainer);
    } catch (error) {
      document.getElementById('menuItems').innerHTML = '<p>Error loading menu items.</p>';
    }
  });
}

// Variable to track the currently selected category
let selectedCategory = '';

// Set up category filters
function setupCategoryFilters() {
  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(link => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      selectedCategory = link.getAttribute('data-category'); // Update selected category

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
        renderMenuItems(filteredItems, menuItemsContainer);
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

// Set up sorting functionality
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

      // Apply category filter before sorting
      let filteredItems = selectedCategory
        ? menuItems.filter(item => item.category === selectedCategory)
        : menuItems;

      // Apply sorting to the filtered items
      switch (sortBy) {
        case 'price-asc':
          filteredItems.sort((a, b) => {
            const aPrice = a.hasSizes && a.sizes?.length > 0 ? Math.min(...a.sizes.map(s => Number(s.price))) : Number(a.basePrice || 0);
            const bPrice = b.hasSizes && b.sizes?.length > 0 ? Math.min(...b.sizes.map(s => Number(s.price))) : Number(b.basePrice || 0);
            return aPrice - bPrice;
          });
          break;
        case 'price-desc':
          filteredItems.sort((a, b) => {
            const aPrice = a.hasSizes && a.sizes?.length > 0 ? Math.max(...a.sizes.map(s => Number(s.price))) : Number(a.basePrice || 0);
            const bPrice = b.hasSizes && b.sizes?.length > 0 ? Math.max(...b.sizes.map(s => Number(s.price))) : Number(b.basePrice || 0);
            return bPrice - aPrice;
          });
          break;
        case 'name-asc':
          filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'name-desc':
          filteredItems.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
      }

      const menuItemsContainer = document.getElementById('menuItems');
      renderMenuItems(filteredItems, menuItemsContainer);
    } catch (error) {
      document.getElementById('menuItems').innerHTML = '<p>Error sorting menu items.</p>';
    }
  });
}

// Initialize the menu page
waitForIncludes(() => {
  fetchMenuItems();
  setupSearch();
  setupSort();
  setupCategoryFilters();
});