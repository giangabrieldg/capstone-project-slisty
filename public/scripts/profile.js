/**
 * Profile Page Manager
 * Handles profile data fetching, updating, tab switching, cart display, and order history
 */
class ProfileManager {
    constructor() {
        this.token = localStorage.getItem('token');
        this.init();
    }

    /**
     * Initialize profile page functionality
     */
    init() {
        if (!this.token) {
            window.location.href = '/public/customer/login.html';
            return;
        }
        this.setupEventListeners();
        this.loadProfile();
        this.loadOrders(); // Load orders on initialization

        const hash = window.location.hash.substring(1);
        const section = hash || 'profile';
        this.showSection(section);
    }

    /**
     * Setup event listeners for navigation and form interactions
     */
    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('href').substring(1);
                this.showSection(section);
            });
        });

        window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1);
        this.showSection(hash || 'profile');
        });

        // Edit profile button
        const editBtn = document.getElementById('editBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.toggleEditForm(true));
        }

        // Cancel edit button
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.toggleEditForm(false));
        }

        // Profile form submission
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileSubmit(e));
        }

        // Logout confirmation
        const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
        if (confirmLogoutBtn) {
            confirmLogoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    /**
     * Show specific section and hide others
     * @param {string} section - Section ID to display
     */
    showSection(section) {
        document.querySelectorAll('.main-content-section').forEach(s => {
            s.style.display = 'none';
        });
        const activeSection = document.getElementById(`${section}-section`);
        if (activeSection) {
            activeSection.style.display = 'block';
        }

        document.querySelectorAll('.sidebar-menu .nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${section}`) {
                link.classList.add('active');
            }
        });
    }

    /**
     * Load user profile data
     */
    async loadProfile() {
        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) throw new Error('Failed to load profile');
            const data = await response.json();
            this.renderProfile(data);
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile. Please log in again.');
            window.location.href = '/public/customer/login.html';
        }
    }

    /**
     * Render profile data
     * @param {Object} profile - Profile data
     */
    renderProfile(profile) {
        document.getElementById('userName').textContent = profile.name || 'Not set';
        document.getElementById('userEmail').textContent = profile.email || 'Not set';
        document.getElementById('userPhone').textContent = profile.phone || 'Not set';
        document.getElementById('userAddress').textContent = profile.address || 'Not set';
    }

    /**
     * Load user orders
     */
    async loadOrders() {
        try {
            const response = await fetch('http://localhost:3000/api/orders/user/me', {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Try to get error details from response
                let errorMsg = 'Failed to load orders';
                try {
                    const errorData = await response.json();
                    errorMsg += `: ${errorData.message || JSON.stringify(errorData)}`;
                } catch (e) {
                    errorMsg += `: HTTP ${response.status}`;
                }
                throw new Error(errorMsg);
            }
            
            const data = await response.json();
            console.log('Orders data:', data); // Debug log
            this.renderOrders(data.orders || []);
            
        } catch (error) {
            console.error('Error loading orders:', error);
            const ordersContent = document.querySelector('.orders-content');
            if (ordersContent) {
                ordersContent.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading order history: ${error.message}
                        <button class="btn btn-sm btn-secondary mt-2" onclick="profileManager.loadOrders()">
                            Retry
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Render orders in the orders section
     * @param {Array} orders - List of orders
     */
    renderOrders(orders) {
        const ordersContent = document.querySelector('.orders-content');
        if (!ordersContent) return;

        if (orders.length === 0) {
            ordersContent.innerHTML = '<p>No orders found.</p>';
            return;
        }

        ordersContent.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Order ID</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Items</th>
                            <th>Delivery</th>
                            <th>Payment</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${orders.map(order => {
                            // Parse items if it's a string
                            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                            return `
                                <tr>
                                    <td>${order.orderId}</td>
                                    <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                                    <td>₱${Number(order.total_amount).toFixed(2)}</td>
                                    <td>
                                        ${items.map(item => `
                                            ${item.name}${item.size ? ` (${item.size})` : ''} x${item.quantity}
                                        `).join('<br>')}
                                    </td>
                                    <td>${order.delivery_method}</td>
                                    <td>${order.payment_method}</td>
                                    <td>${order.status}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Toggle edit profile form visibility
     * @param {boolean} show - Show or hide form
     */
    toggleEditForm(show) {
        const editForm = document.getElementById('editForm');
        const editBtn = document.getElementById('editBtn');
        if (editForm && editBtn) {
            editForm.style.display = show ? 'block' : 'none';
            editBtn.style.display = show ? 'none' : 'block';
            if (show) {
                document.getElementById('editName').value = document.getElementById('userName').textContent;
                document.getElementById('editPhone').value = document.getElementById('userPhone').textContent;
                document.getElementById('editAddress').value = document.getElementById('userAddress').textContent === 'Not set' ? '' : document.getElementById('userAddress').textContent;
            }
        }
    }

    /**
     * Handle profile form submission
     * @param {Event} e - Form submission event
     */
    async handleProfileSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('editName').value;
        const phone = document.getElementById('editPhone').value;
        const address = document.getElementById('editAddress').value;

        // Basic validation
        if (!name) {
            document.getElementById('nameError').textContent = 'Name is required';
            document.getElementById('editName').classList.add('is-invalid');
            return;
        }
        if (phone && !/^\+639\d{9}$/.test(phone)) {
            document.getElementById('phoneError').textContent = 'Invalid phone number format';
            document.getElementById('editPhone').classList.add('is-invalid');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, phone, address })
            });
            if (!response.ok) throw new Error('Failed to update profile');
            const data = await response.json();
            this.renderProfile(data);
            this.toggleEditForm(false);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile. Please try again.');
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        localStorage.removeItem('token');
        window.location.href = '/public/customer/login.html';
    }
}

// Instantiate the manager
const profileManager = new ProfileManager();