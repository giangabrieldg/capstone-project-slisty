function includeAdminSidebar() {
  const includeElements = document.querySelectorAll('[data-include-admin-sidebar]');

  includeElements.forEach(el => {
    const file = el.getAttribute('data-include-admin-sidebar');
    if (file) {
      fetch(file)
        .then(response => response.text())
        .then(data => {
          el.innerHTML = data;
          el.removeAttribute('data-include-admin-sidebar');

          // DOM is ready — initialize sidebar
          requestAnimationFrame(() => {
            initializeAdminSidebar(el); // Call initialization logic
          });
        })
        .catch(error => console.error("Error including admin sidebar:", error));
    }
  });
}

function initializeAdminSidebar(container) {
  const toggleButton = document.querySelector(".sidebar-toggle"); // toggle button (outside sidebar)
  const sidebar = container.querySelector(".sidebar"); // sidebar (inside injected container)
  const navLinks = container.querySelectorAll(".sidebar-nav .nav-item");

  // Sidebar toggle (for mobile)
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });
  }

  // Set active nav link based on current path
  if (navLinks.length > 0) {
    const currentPath = window.location.pathname;

    navLinks.forEach(link => {
      const linkPath = new URL(link.href, window.location.origin).pathname;

      // Skip logout link from getting 'active'
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

    // Highlight on click (client-side highlight only)
    navLinks.forEach(link => {
      link.addEventListener("click", function () {
        navLinks.forEach(nav => nav.classList.remove("active"));
        this.classList.add("active");
      });
    });
  }

  // ✅ Move Logout Handler HERE (after sidebar is injected)
  const logoutLink = container.querySelector("#logoutLink");

  if (logoutLink) {
    logoutLink.addEventListener("click", (e) => {
      e.preventDefault();

      // Clear session/token
      localStorage.removeItem("token");
      sessionStorage.clear();

      // Redirect to login
      window.location.href = "/public/customer/login.html"; // adjust if needed
    });
  } else {
    console.warn("Logout link not found.");
  }
}

// Run include logic on DOM ready
document.addEventListener("DOMContentLoaded", includeAdminSidebar);
