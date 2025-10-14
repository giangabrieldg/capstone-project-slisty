// Function to fetch cart item count from API and update the badge
async function updateCartCount() {
  const token = sessionStorage.getItem("token");
  const cartCountBadge = document.getElementById("cartCountBadge");

  if (!token || !cartCountBadge) {
    return;
  }

  try {
    const response = await fetch(`${window.API_BASE_URL}/api/cart`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn("Failed to fetch cart items for count.");
      cartCountBadge.style.display = "none";
      return;
    }

    const data = await response.json();
    const cartItems = data.cartItems || [];
    const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (totalCount > 0) {
      cartCountBadge.textContent = totalCount;
      cartCountBadge.style.display = "inline-block";
    } else {
      cartCountBadge.style.display = "none";
    }
  } catch (error) {
    console.error("Error fetching cart count:", error);
    cartCountBadge.style.display = "none";
  }
}

// Function to check for new notifications
async function checkNotifications() {
    const token = sessionStorage.getItem("token");
    const notificationBadge = document.getElementById("notificationBadge");

    if (!token) {
        if (notificationBadge) notificationBadge.style.display = 'none';
        return;
    }

    if (!notificationBadge) {
        console.warn('Notification badge element not found');
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/notifications/unread-count`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Unread notifications count:', data.count);
            
            if (data.count > 0) {
                notificationBadge.textContent = data.count > 9 ? '9+' : data.count.toString();
                notificationBadge.style.display = 'inline-block';
            } else {
                notificationBadge.style.display = 'none';
            }
        } else {
            console.warn('Failed to fetch notifications count:', response.status);
            notificationBadge.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking notifications:', error);
        if (notificationBadge) notificationBadge.style.display = 'none';
    }
}

// Function to load notifications for dropdown
async function loadNotifications() {
    const token = sessionStorage.getItem("token");
    const notificationList = document.getElementById("notificationList");

    if (!token || !notificationList) {
        return;
    }

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/notifications`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            const data = await response.json();
            displayNotifications(data.notifications);
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
        notificationList.innerHTML = '<div class="no-notifications">Error loading notifications</div>';
    }
}

// Function to display notifications in dropdown with unread highlighting
function displayNotifications(notifications) {
    const notificationList = document.getElementById("notificationList");
    
    if (!notificationList) {
        console.error('Notification list element not found');
        return;
    }

    if (!notifications || notifications.length === 0) {
        notificationList.innerHTML = '<div class="no-notifications">No notifications</div>';
        return;
    }

    notificationList.innerHTML = notifications.map(notif => `
        <div class="notification-item ${!notif.isRead ? 'unread' : ''}" 
             onclick="handleNotificationClick('${notif.id}', '${notif.type}', ${!notif.isRead}, '${notif.relatedId}')">
            <div class="notification-title">
                ${escapeHtml(notif.title)}
                ${!notif.isRead ? '<span class="unread-indicator">●</span>' : ''}
            </div>
            <div class="notification-message">${escapeHtml(notif.message)}</div>
            <div class="notification-time">${formatTime(notif.time)}</div>
        </div>
    `).join('');
}

// Mark all notifications as read when dropdown is opened
async function markAllNotificationsAsRead() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/notifications/mark-read`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            // Update badge count after marking as read
            await checkNotifications();
            // Update the display to remove unread styling
            const unreadItems = document.querySelectorAll('.notification-item.unread');
            unreadItems.forEach(item => {
                item.classList.remove('unread');
                const indicator = item.querySelector('.unread-indicator');
                if (indicator) indicator.remove();
            });
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Mark single notification as read
async function markNotificationAsRead(notificationId) {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
        const response = await fetch(`${window.API_BASE_URL}/api/notifications/${notificationId}/read`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        });

        if (response.ok) {
            // Update badge count
            await checkNotifications();
            // Update the specific notification item
            const notificationItem = document.querySelector(`[onclick*="${notificationId}"]`);
            if (notificationItem) {
                notificationItem.classList.remove('unread');
                const indicator = notificationItem.querySelector('.unread-indicator');
                if (indicator) indicator.remove();
            }
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

// Notification toggle functions
function toggleNotifications(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const dropdown = document.getElementById("notificationDropdown");
    const backdrop = document.querySelector('.notification-backdrop');
    
    if (!dropdown || !backdrop) {
        console.error('Notification elements not found');
        return;
    }
    
    if (dropdown.classList.contains('show')) {
        closeNotifications();
    } else {
        dropdown.classList.add('show');
        backdrop.classList.add('show');
        loadNotifications();
        // Mark all as read when opening dropdown
        markAllNotificationsAsRead();
    }
}

function handleNotificationClick(notificationId, notificationType, isUnread, relatedId) {
    console.log('Notification clicked:', notificationId, notificationType, isUnread, relatedId);
    
    // If it's unread, mark it as read
    if (isUnread) {
        markNotificationAsRead(notificationId);
    }
    
    closeNotifications();
    
    // Navigate based on notification type and relatedId
    switch (notificationType) {
        case 'order':
            // Navigate to profile page with orders tab active
            window.location.href = '/customer/profile.html#orders';
            break;
            
        case 'custom_cake':
            // Navigate to custom orders page (it shows both types)
            window.location.href = '/customer/custom-orders.html';
            break;
            
        case 'image_order':
            // Navigate to custom orders page (it shows both types)
            window.location.href = '/customer/custom-orders.html';
            break;
            
        default:
            console.warn('Unknown notification type:', notificationType);
            window.location.href = '/customer/profile.html#orders';
    }
}

function viewAllNotifications() {
    closeNotifications();
    // Navigate to orders page
    window.location.href = '/customer/profile.html#orders';
}


// Utility functions
function formatTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateNavbarAndGreeting() {
  const token = sessionStorage.getItem("token");
  const userCartContainer = document.getElementById("userCartContainer");
  const userProfileContainer = document.getElementById("userProfileContainer");
  const userProfileLink = document.getElementById("userProfileLink");
  const customCakeOrdersItem = document.getElementById("customCakeOrdersItem");
  const notificationContainer = document.getElementById("notificationContainer");
  
  let userNameSpan = null;

  if (userProfileLink) {
    userNameSpan = userProfileLink.querySelector("span");
  }

  if (!userCartContainer || !userProfileContainer || !userProfileLink) {
    console.warn("Navbar elements not found. Make sure navbar is loaded.");
    return;
  }

  if (token) {
    // User is logged in
    userCartContainer.style.display = "block";
    userProfileContainer.style.display = "block";
    notificationContainer.style.display = "block";
    userProfileLink.href = "/customer/profile.html";
    
    if (customCakeOrdersItem) {
      customCakeOrdersItem.style.display = "block";
    }
    
    if (userNameSpan) userNameSpan.textContent = sessionStorage.getItem("userName") || "User Profile";
    
    if (window.location.pathname.includes("profile.html")) {
      const userNameElement = document.getElementById("userName");
      const userEmailElement = document.getElementById("userEmail");
      if (userNameElement) userNameElement.textContent = sessionStorage.getItem("userName") || "Guest";
      if (userEmailElement) userEmailElement.textContent = sessionStorage.getItem("userEmail") || "Not set";
    }
    
    updateCartCount();
    checkNotifications();
    
    if (!window.notificationInterval) {
      window.notificationInterval = setInterval(checkNotifications, 30000);
    }
    
  } else {
    userCartContainer.style.display = "none";
    userProfileContainer.style.display = "block";
    notificationContainer.style.display = "none";
    userProfileLink.href = "/customer/login.html";
    
    if (customCakeOrdersItem) {
      customCakeOrdersItem.style.display = "none";
    }
    
    if (userNameSpan) userNameSpan.textContent = "User Profile";
    
    if (window.location.pathname.includes("profile.html")) {
      const userNameElement = document.getElementById("userName");
      const userEmailElement = document.getElementById("userEmail");
      if (userNameElement) userNameElement.textContent = "Guest";
      if (userEmailElement) userEmailElement.textContent = "Not logged in";
    }
    
    if (window.notificationInterval) {
      clearInterval(window.notificationInterval);
      window.notificationInterval = null;
    }
  }
}

function closeNotifications() {
    const dropdown = document.getElementById("notificationDropdown");
    const backdrop = document.querySelector('.notification-backdrop');
    
    if (dropdown) dropdown.classList.remove('show');
    if (backdrop) backdrop.classList.remove('show');
}

// Update the click outside handler
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('notificationDropdown');
    const notificationContainer = document.getElementById('notificationContainer');
    const notificationBell = document.querySelector('[onclick="toggleNotifications(event)"]');
    
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(event.target) && 
            !notificationBell.contains(event.target)) {
            closeNotifications();
        }
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeNotifications();
    }
});

// Ensure function runs after DOM and includes are loaded
document.addEventListener("DOMContentLoaded", () => {
  updateNavbarAndGreeting();
});

document.addEventListener('html-includes-loaded', updateNavbarAndGreeting);