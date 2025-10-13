// toast-notifications.js
class ToastNotifications {
  static showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;

    ToastNotifications.injectToastStyles();
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 100);

    // Remove after 4 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 4000);
  }

  static injectToastStyles() {
    if (document.getElementById('toast-styles')) return;

    const styles = `
      <style id="toast-styles">
        .toast-notification {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ff6b6b;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          transform: translateX(400px);
          transition: transform 0.3s ease;
          max-width: 300px;
        }
        .toast-notification.show {
          transform: translateX(0);
        }
        .toast-notification.success {
          background: var(--primary-color);
        }
      </style>
    `;
    document.head.insertAdjacentHTML('beforeend', styles);
  }
}

// Make it available globally
window.ToastNotifications = ToastNotifications;