function includeAdminSidebar() {
  const includeElements = document.querySelectorAll('[data-include-admin-sidebar]');

  includeElements.forEach(el => {
    const file = el.getAttribute('data-include-admin-sidebar');
    if (file) {
      fetch(file)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file}: ${response.statusText}`);
          }
          return response.text();
        })
        .then(data => {
          el.innerHTML = data;
          el.removeAttribute('data-include-admin-sidebar');
          console.log("Sidebar loaded successfully");

          // DOM is ready — initialize sidebar
          requestAnimationFrame(() => {
            initializeAdminSidebar(el);
          });
        })
        .catch(error => console.error("Error including admin sidebar:", error));
    }
  });
}

async function initializeAdminSidebar(container) {
  const toggleButton = document.querySelector(".sidebar-toggle");
  const sidebar = container.querySelector(".sidebar");
  const navLinks = container.querySelectorAll(".sidebar-nav .nav-item");
  const token = localStorage.getItem("token");

  // Validate user data - FIXED: Remove BASE_URL parameter
  const userData = await validateToken(); // ✅ Removed BASE_URL parameter
  console.log("User data from API:", userData);
  console.log("Token exists:", !!localStorage.getItem("token"));

  // Validate token on page load
  if (!token || !userData)  {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = "/customer/login.html";
    return;
  }

   updateUserInfo(container, userData);

  // Sidebar toggle (for mobile)
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("show");
      document.body.classList.toggle("sidebar-visible");
      console.log("Sidebar toggled, show class:", sidebar.classList.contains("show"));
    });
  } else {
    console.error("Toggle button or sidebar not found:", { toggleButton, sidebar });
  }

  // Set active nav link based on current path
  if (navLinks.length > 0) {
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
      const linkPath = new URL(link.href, window.location.origin).pathname;

      if (link.id === "logoutLink") {
        link.classList.remove("active");
        return;
      }

      if (currentPath === linkPath) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    navLinks.forEach(link => {
      link.addEventListener("click", function () {
        navLinks.forEach(nav => nav.classList.remove("active"));
        this.classList.add("active");
      });
    });
  }

  // Logout Handler
  const logoutLink = container.querySelector("#logoutLink");
  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();
      localStorage.clear();
      sessionStorage.clear();
      window.history.pushState(null, null, '/customer/login.html');
      window.location.href = "/customer/login.html";
      window.addEventListener('popstate', () => {
        window.location.href = '/customer/login.html';
      });
    });
  } else {
    console.warn("Logout link not found.");
  }
}

// Validate token with server - FIXED: Remove BASE_URL parameter
async function validateToken() { // ✅ Removed BASE_URL parameter
  const token = localStorage.getItem("token");
  try {
    const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const userData = await response.json();
    if (!response.ok) {
      console.warn("Token validation failed with status:", response.status);
      return userData
    }
    console.log("Token validation succeeded with status:", response.status);
    return userData;
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

function updateUserInfo(container, userData) {
  const userNameElement = container.querySelector("#userName");
  const userRoleElement = container.querySelector("#userRole");

  if (userNameElement && userData.name) {
    userNameElement.textContent = userData.name;
  }
  if (userRoleElement && userData.userLevel) {
    userRoleElement.textContent = userData.userLevel;
  }
}

document.addEventListener("DOMContentLoaded", includeAdminSidebar);