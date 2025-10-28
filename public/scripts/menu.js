// script for displaying menu items in customer side
function waitForIncludes(callback) {
  const checkIncludes = () => {
    const includes = document.querySelectorAll("[data-include-html]");
    if (
      includes.length === 0 ||
      Array.from(includes).every((el) => el.innerHTML.trim() !== "")
    ) {
      callback();
    } else {
      setTimeout(checkIncludes, 100);
    }
  };
  checkIncludes();
}

function renderMenuItems(menuItems, container, showPriceStock = false) {
  container.innerHTML = "";
  if (menuItems.length === 0) {
    container.innerHTML = "<p>No items found in this category.</p>";
    return;
  }

  menuItems.forEach((item) => {
    const col = document.createElement("div");
    col.className = "col-lg-4 col-md-6 col-12 mb-4";
    col.setAttribute("data-category", item.category || "");

    const hasStock = item.hasSizes
      ? item.sizes.some((size) => size.stock > 0)
      : item.stock > 0;
    const viewDetailsClass = hasStock
      ? "view-details-btn"
      : "view-details-btn disabled";

    const imageSrc =
      item.image && item.image.trim() !== ""
        ? item.image
        : "https://via.placeholder.com/600x400?text=No+Image";

    // Calculate price display
    let priceDisplay = "";
    if (item.hasSizes && item.sizes && item.sizes.length > 0) {
      // For items with multiple sizes, show price range
      const prices = item.sizes
        .map((size) => Number(size.price))
        .filter((price) => !isNaN(price));
      if (prices.length > 0) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        if (minPrice === maxPrice) {
          priceDisplay = `₱${minPrice.toFixed(2)}`;
        } else {
          priceDisplay = `₱${minPrice.toFixed(2)} - ₱${maxPrice.toFixed(2)}`;
        }
      } else {
        priceDisplay = "Price varies";
      }
    } else if (item.basePrice) {
      // For items with single price
      priceDisplay = `₱${Number(item.basePrice).toFixed(2)}`;
    } else {
      priceDisplay = "Price not set";
    }

    // load menu item card with price
    const cardMinimal = `
      <div class="card h-100 minimal">
        <div class="menu-image-wrapper">
          <img src="${imageSrc}" class="card-img-top" alt="${
      item.name || "Unknown"
    }">
        </div>
        <div class="card-body">
          <div class="card-content">
            <h5 class="card-title">${item.name || "Unknown Item"}</h5>
            <p class="card-text description">${
              item.description || "No description available"
            }</p>
            <p class="card-text price">${priceDisplay}</p>
          </div>
          <div class="card-details">
            <a href="/customer/products.html?id=${
              item.menuId || ""
            }" class="${viewDetailsClass}">
              ${hasStock ? "View Details" : "Out of Stock"}
            </a>
          </div>
        </div>
      </div>
    `;

    col.innerHTML = cardMinimal;
    container.appendChild(col);
  });
}

async function fetchMenuItems() {
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/menu`);
    const menuItems = await response.json();
    if (!response.ok) {
      document.getElementById(
        "menuItems"
      ).innerHTML = `<p>Failed to load menu items: ${
        menuItems.error || "Server error"
      }</p>`;
      return;
    }
    const menuItemsContainer = document.getElementById("menuItems");
    if (!menuItemsContainer) {
      document.body.innerHTML += "<p>Error: Menu container not found.</p>";
      return;
    }
    renderMenuItems(menuItems, menuItemsContainer);
  } catch (error) {
    console.error("Error fetching menu items:", error.message);
    document.getElementById("menuItems").innerHTML =
      "<p>Error loading menu items. Please try again later.</p>";
  }
}

function setupSearch() {
  const searchInput = document.querySelector(".search-input");
  if (!searchInput) return;

  searchInput.addEventListener("input", async (e) => {
    const searchTerm = e.target.value.toLowerCase();
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/menu`);
      const menuItems = await response.json();
      if (!response.ok) {
        document.getElementById(
          "menuItems"
        ).innerHTML = `<p>Failed to load menu items: ${
          menuItems.error || "Server error"
        }</p>`;
        return;
      }
      const menuItemsContainer = document.getElementById("menuItems");
      const filteredItems = menuItems.filter(
        (item) =>
          (item.name || "").toLowerCase().includes(searchTerm) ||
          (item.category || "").toLowerCase().includes(searchTerm)
      );
      renderMenuItems(filteredItems, menuItemsContainer);
    } catch (error) {
      document.getElementById("menuItems").innerHTML =
        "<p>Error loading menu items.</p>";
    }
  });
}

let selectedCategory = "";

function setupCategoryFilters() {
  const categoryFilters = document.querySelectorAll(".category-filter");
  categoryFilters.forEach((link) => {
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      selectedCategory = link.getAttribute("data-category");

      categoryFilters.forEach((el) => el.classList.remove("active"));
      e.target.classList.add("active");

      try {
        const response = await fetch(`${window.API_BASE_URL}/api/menu`);
        const menuItems = await response.json();
        if (!response.ok) {
          document.getElementById(
            "menuItems"
          ).innerHTML = `<p>Failed to load menu items: ${
            menuItems.error || "Server error"
          }</p>`;
          return;
        }
        const filteredItems = selectedCategory
          ? menuItems.filter((item) => item.category === selectedCategory)
          : menuItems;
        const menuItemsContainer = document.getElementById("menuItems");
        renderMenuItems(filteredItems, menuItemsContainer);
      } catch (error) {
        document.getElementById("menuItems").innerHTML =
          "<p>Error loading menu items.</p>";
      }
    });
  });

  const allCategoryLink = document.querySelector(
    '.category-filter[data-category=""]'
  );
  if (allCategoryLink) {
    allCategoryLink.classList.add("active");
  }
}

function setupSort() {
  const sortSelect = document.querySelector(".sort-select");
  if (!sortSelect) return;

  sortSelect.addEventListener("change", async (e) => {
    const sortBy = e.target.value;
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/menu`);
      let menuItems = await response.json();
      if (!response.ok) {
        document.getElementById(
          "menuItems"
        ).innerHTML = `<p>Failed to load menu items: ${
          menuItems.error || "Server error"
        }</p>`;
        return;
      }

      let filteredItems = selectedCategory
        ? menuItems.filter((item) => item.category === selectedCategory)
        : menuItems;

      switch (sortBy) {
        case "price-asc":
          filteredItems.sort((a, b) => {
            const aPrice =
              a.hasSizes && a.sizes?.length > 0
                ? Math.min(...a.sizes.map((s) => Number(s.price)))
                : Number(a.basePrice || 0);
            const bPrice =
              b.hasSizes && b.sizes?.length > 0
                ? Math.min(...b.sizes.map((s) => Number(s.price)))
                : Number(b.basePrice || 0);
            return aPrice - bPrice;
          });
          break;
        case "price-desc":
          filteredItems.sort((a, b) => {
            const aPrice =
              a.hasSizes && a.sizes?.length > 0
                ? Math.max(...a.sizes.map((s) => Number(s.price)))
                : Number(a.basePrice || 0);
            const bPrice =
              b.hasSizes && b.sizes?.length > 0
                ? Math.max(...b.sizes.map((s) => Number(s.price)))
                : Number(b.basePrice || 0);
            return bPrice - aPrice;
          });
          break;
        case "name-asc":
          filteredItems.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          break;
        case "name-desc":
          filteredItems.sort((a, b) =>
            (b.name || "").localeCompare(a.name || "")
          );
          break;
      }

      const menuItemsContainer = document.getElementById("menuItems");
      renderMenuItems(filteredItems, menuItemsContainer);
    } catch (error) {
      document.getElementById("menuItems").innerHTML =
        "<p>Error sorting menu items.</p>";
    }
  });
}

waitForIncludes(() => {
  fetchMenuItems();
  setupSearch();
  setupSort();
  setupCategoryFilters();
});
