// update-navbar.js
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
    userProfileLink.href = "/pages/customer/profile.html";
    if (userNameSpan) userNameSpan.textContent = localStorage.getItem("userName") || "User Profile";
    // Update profile.html content if on that page
    if (window.location.pathname.includes("profile.html")) {
      document.getElementById("userName").textContent = localStorage.getItem("userName") || "Guest";
      document.getElementById("userEmail").textContent = localStorage.getItem("userEmail") || "Not set";
    }
  } else {
    userCartContainer.style.display = "none";
    userProfileContainer.style.display = "block";
    userProfileLink.href = "/pages/customer/login.html";
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