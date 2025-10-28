async function includeHTML() {
  const includeElements = document.querySelectorAll("[data-include-html]");

  if (includeElements.length === 0) {
    document.dispatchEvent(new Event("html-includes-loaded"));
    initializeActiveLink();
    return;
  }

  // Load all includes in parallel
  const includePromises = Array.from(includeElements).map(async (el) => {
    const file = el.getAttribute("data-include-html");
    if (file) {
      try {
        const response = await fetch(file);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.text();
        el.innerHTML = data;
        el.removeAttribute("data-include-html");

        // Execute any scripts within the included HTML
        const scripts = el.querySelectorAll("script");
        scripts.forEach((script) => {
          const newScript = document.createElement("script");
          if (script.src) {
            newScript.src = script.src;
            newScript.async = false;
          } else {
            newScript.textContent = script.textContent;
          }
          script.parentNode.replaceChild(newScript, script);
        });

        return true;
      } catch (error) {
        console.error("Error including HTML:", error);
        el.innerHTML = "Page not found.";
        return false;
      }
    }
  });

  await Promise.all(includePromises);

  // Check for any new includes that were added (nested includes)
  const remainingIncludes = document.querySelectorAll("[data-include-html]");
  if (remainingIncludes.length > 0) {
    includeHTML(); // Recursive for nested includes
  } else {
    document.dispatchEvent(new Event("html-includes-loaded"));
    initializeActiveLink();
  }
}

// Initialize active link function remains the same
function initializeActiveLink() {
  const navLinks = document.querySelectorAll(".sidebar-menu .nav-link");

  navLinks.forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      window.location.hash = this.getAttribute("href").substring(1);
      navLinks.forEach((nav) => nav.classList.remove("active"));
      this.classList.add("active");
    });
  });

  function setActiveLink() {
    const currentHash = window.location.hash || "#profile";
    const activeLink = document.querySelector(
      `.sidebar-menu .nav-link[href="${currentHash}"]`
    );
    if (activeLink) {
      navLinks.forEach((nav) => nav.classList.remove("active"));
      activeLink.classList.add("active");
    }
  }

  window.addEventListener("hashchange", setActiveLink);
  setActiveLink();
}

// Start loading includes immediately when script loads
includeHTML();
