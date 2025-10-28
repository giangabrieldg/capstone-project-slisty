// Add this to your admin-cake.js file or create a new script

function initDoubleScrollbar() {
  // Get all table-responsive elements
  const tableContainers = document.querySelectorAll(".table-responsive");

  tableContainers.forEach((container) => {
    // Skip if already initialized
    if (container.classList.contains("scrollbar-initialized")) {
      return;
    }

    // Create wrapper
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll-wrapper";

    // Create top scrollbar container
    const topScroll = document.createElement("div");
    topScroll.className = "table-scroll-top";

    // Create inner div for top scrollbar
    const topScrollInner = document.createElement("div");
    topScrollInner.className = "table-scroll-top-inner";
    topScroll.appendChild(topScrollInner);

    // Insert wrapper before the table container
    container.parentNode.insertBefore(wrapper, container);

    // Move elements into wrapper
    wrapper.appendChild(topScroll);
    wrapper.appendChild(container);

    // Add bottom scroll class
    container.classList.add("table-scroll-bottom");

    // Function to sync scroll width
    function syncScrollWidth() {
      const table = container.querySelector("table");
      if (table) {
        topScrollInner.style.width = table.offsetWidth + "px";
      }
    }

    // Sync scrolling between top and bottom
    topScroll.addEventListener("scroll", function () {
      container.scrollLeft = topScroll.scrollLeft;
    });

    container.addEventListener("scroll", function () {
      topScroll.scrollLeft = container.scrollLeft;
    });

    // Initial sync
    syncScrollWidth();

    // Re-sync on window resize
    window.addEventListener("resize", syncScrollWidth);

    // Re-sync when table content changes (use MutationObserver)
    const observer = new MutationObserver(syncScrollWidth);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // Mark as initialized
    container.classList.add("scrollbar-initialized");

    // Re-sync after a short delay (for dynamic content)
    setTimeout(syncScrollWidth, 100);
    setTimeout(syncScrollWidth, 500);
  });
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDoubleScrollbar);
} else {
  initDoubleScrollbar();
}

// Re-initialize when tab is switched (for Bootstrap tabs)
document.addEventListener("shown.bs.tab", function () {
  setTimeout(initDoubleScrollbar, 50);
});
