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

function initializeAdminSidebar(container) {
  const toggleButton = document.querySelector(".sidebar-toggle");
  const sidebar = container.querySelector(".sidebar");
  const navLinks = container.querySelectorAll(".sidebar-nav .nav-item");

  // Sidebar toggle (for mobile)
  if (toggleButton && sidebar) {
    toggleButton.addEventListener("click", () => {
      sidebar.classList.toggle("show");
      document.body.classList.toggle("sidebar-visible"); // Sync with admin-menu.css
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
      localStorage.removeItem("token");
      sessionStorage.clear();
      window.location.href = "/public/customer/login.html";
    });
  } else {
    console.warn("Logout link not found.");
  }
}

document.addEventListener("DOMContentLoaded", includeAdminSidebar);