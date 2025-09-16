// /public/scripts/path-config.js
if (typeof window.isLocalhost === 'undefined') {
  window.isLocalhost = window.location.hostname === "localhost" || 
                       window.location.hostname === "127.0.0.1" ||
                       window.location.hostname === "";
}

if (typeof window.BASE_URL === 'undefined') {
  window.BASE_URL = window.isLocalhost
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "https://slice-n-grind.onrender.com";
}

if (typeof window.PUBLIC_PREFIX === 'undefined') {
  window.PUBLIC_PREFIX = window.isLocalhost ? "/public" : "";
}

// Helper for static assets in /public
window.getFullPath = (path) => {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${window.PUBLIC_PREFIX}/${cleanPath}`.replace(/\/\/+/g, '/');
};

// Helper for uploads outside /public
window.getUploadPath = (path) => {
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `/uploads/${cleanPath.replace(/^uploads\//i, '')}`.replace(/\/\/+/g, '/');
};

window.fixResourcePaths = () => {
  // Fix img[src]
  document.querySelectorAll('img[src]').forEach(img => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('/') && !src.includes('://') && !src.startsWith('data:')) {
      if (src.startsWith('/uploads/')) {
        img.src = window.getUploadPath(src);
        console.log(`Fixed upload img src: ${img.src}`);
      } else if (!src.startsWith(window.PUBLIC_PREFIX)) {
        img.src = window.getFullPath(src);
        console.log(`Fixed img src: ${img.src}`);
      }
    }
  });

  // Fix a[href]
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith(window.PUBLIC_PREFIX) && 
        !href.includes('://') && !href.startsWith('#')) {
      a.href = window.getFullPath(href);
      console.log(`Fixed a href: ${a.href}`);
    }
  });

  // Fix link[href]
  document.querySelectorAll('link[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith(window.PUBLIC_PREFIX) && 
        !href.includes('://') && !href.startsWith('data:')) {
      link.href = window.getFullPath(href);
      console.log(`Fixed link href: ${link.href}`);
    }
  });

  // Fix script[src]
  document.querySelectorAll('script[src]').forEach(script => {
    const src = script.getAttribute('src');
    if (src && src.startsWith('/') && !src.startsWith(window.PUBLIC_PREFIX) && 
        !src.includes('://') && !src.startsWith('data:')) {
      script.src = window.getFullPath(src);
      console.log(`Fixed script src: ${script.src}`);
    }
  });

  // Fix data-include-html
  document.querySelectorAll('[data-include-html]').forEach(element => {
    const includePath = element.getAttribute('data-include-html');
    if (includePath && includePath.startsWith('/') && !includePath.startsWith(window.PUBLIC_PREFIX)) {
      element.setAttribute('data-include-html', window.getFullPath(includePath));
      console.log(`Fixed include path: ${element.getAttribute('data-include-html')}`);
    }
  });
};

// Run immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log("Running fixResourcePaths on DOMContentLoaded");
    window.fixResourcePaths();
  });
} else {
  console.log("Running fixResourcePaths immediately");
  window.fixResourcePaths();
}

// Re-run on custom include event
document.addEventListener('html-includes-loaded', () => {
  console.log("Running fixResourcePaths on html-includes-loaded");
  window.fixResourcePaths();
});

console.log("Path configuration loaded:", {
  isLocalhost: window.isLocalhost,
  BASE_URL: window.BASE_URL,
  PUBLIC_PREFIX: window.PUBLIC_PREFIX
});