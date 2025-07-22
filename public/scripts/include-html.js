function includeHTML() {
  const includeElements = document.querySelectorAll('[data-include-html]');
  if (includeElements.length === 0) {
    setTimeout(() => {
      document.dispatchEvent(new Event('html-includes-loaded'));
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

document.addEventListener("DOMContentLoaded", () => {
  includeHTML();
});