function includeHTML() {
  const includeElements = document.querySelectorAll('[data-include-html]');
  
  if (includeElements.length === 0) {
    setTimeout(() => {
      document.dispatchEvent(new Event('html-includes-loaded'));
      // Initialize active link logic after all includes are loaded
      initializeActiveLink();
    }, 100); // Delay to ensure DOM update
    return;
  }

  includeElements.forEach(el => {
    const file = el.getAttribute('data-include-html');
    if (file) {
      fetch(file)
        .then(response => {
          if (!response.ok) throw new Error('Network response was not ok');
          return response.text();
        })
        .then(data => {
          el.innerHTML = data;
          el.removeAttribute('data-include-html');
          includeHTML(); // Recursive for nested includes
        })
        .catch(error => {
          el.innerHTML = "Page not found.";
          console.error('Error including HTML:', error);
        });
    }
  });
}

function initializeActiveLink() {
  const navLinks = document.querySelectorAll(".sidebar-menu .nav-link");

  // Add click event listeners to toggle active class
  navLinks.forEach(link => {
    link.addEventListener("click", function (e) {
      e.preventDefault(); // Prevent default link behavior
      // Update URL hash
      window.location.hash = this.getAttribute('href').substring(1);
      // Remove active class from all links
      navLinks.forEach(nav => nav.classList.remove("active"));
      // Add active class to clicked link
      this.classList.add("active");
    });
  });

  // Set active link based on current URL hash
  function setActiveLink() {
    const currentHash = window.location.hash || "#profile"; // Default to #profile if no hash
    const activeLink = document.querySelector(`.sidebar-menu .nav-link[href="${currentHash}"]`);
    if (activeLink) {
      navLinks.forEach(nav => nav.classList.remove("active"));
      activeLink.classList.add("active");
    }
  }

  // Set active link on hash change
  window.addEventListener('hashchange', setActiveLink);
  // Set initial active link
  setActiveLink();
}

document.addEventListener("DOMContentLoaded", () => {
  includeHTML();
});
