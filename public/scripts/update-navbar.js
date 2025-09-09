// update-navbar.js

// Dynamic BASE_URL for local and production
const BASE_URL = window.location.hostname === "localhost"
  ? "http://localhost:3000"
  : "https://capstone-project-slisty.onrender.com";

// Function to fetch cart item count from API and update the badge
async function updateCartCount() {
  const token = localStorage.getItem("token");
  const cartCountBadge = document.getElementById("cartCountBadge");

  if (!token || !cartCountBadge) {
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/cart`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn("Failed to fetch cart items for count:", response.status);
      cartCountBadge.style.display = "none";
      return;
    }

    const data = await response.json();
    const cartItems = data.cartItems || [];
    // Calculate total quantity of items in cart
    const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalCount > 0) {
      cartCountBadge.textContent = totalCount;
      cartCountBadge.style.display = "inline-block";
    } else {
      cartCountBadge.style.display = "none";
    }
  } catch (error) {
    console.error("Error fetching cart count:", error);
    cartCountBadge.style.display = "none";
  }
}

function updateNavbarAndGreeting() {
  const token = localStorage.getItem("token");
  const userCartContainer = document.getElementById("userCartContainer");
  const userProfileContainer = document.getElementById("userProfileContainer");
  const userProfileLink = document.getElementById("userProfileLink");
  let userNameSpan = null;

  // Check if userProfileLink exists and has a span
  if (userProfileLink) {
    userNameSpan = userProfileLink.querySelector("span");
  }

  if (!userCartContainer || !userProfileContainer || !userProfileLink) {
    console.warn("Navbar elements not found. Make sure navbar is loaded.");
    return; // Exit if critical elements are missing
  }

  if (token) {
    userCartContainer.style.display = "block";
    userProfileContainer.style.display = "block";
    userProfileLink.href = "/public/customer/profile.html";
    if (userNameSpan) userNameSpan.textContent = localStorage.getItem("userName") || "User Profile";
    // Update profile.html content if on that page
    if (window.location.pathname.includes("profile.html")) {
      document.getElementById("userName").textContent = localStorage.getItem("userName") || "Guest";
      document.getElementById("userEmail").textContent = localStorage.getItem("userEmail") || "Not set";
    }
    // Update cart count badge
    updateCartCount();
  } else {
    userCartContainer.style.display = "none";
    userProfileContainer.style.display = "block";
    userProfileLink.href = "/public/customer/login.html";
    if (userNameSpan) userNameSpan.textContent = "User Profile";
    if (window.location.pathname.includes("profile.html")) {
      document.getElementById("userName").textContent = "Guest";
      document.getElementById("userEmail").textContent = "Not logged in";
    }
  }
}

// Ensure function runs after DOM and includes are loaded
document.addEventListener("DOMContentLoaded", () => {
  updateNavbarAndGreeting();
});

document.addEventListener('html-includes-loaded', updateNavbarAndGreeting);