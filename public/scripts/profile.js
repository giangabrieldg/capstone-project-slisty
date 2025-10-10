 //Handles profile data fetching, updating, tab switching, cart display, and order history
 
class ProfileManager {
    constructor() {
        this.token = localStorage.getItem('token');
        // Dynamic API URL - same approach as your other modules
        this.init();
    }

    //initialiaze page
    async init() {
        if (!this.token) {
            window.location.href = '/customer/login.html';
            return;
        }
        
        // Validate token with server before proceeding
        const isValid = await this.validateToken();
        if (!isValid) {
            localStorage.removeItem('token');
            window.location.href = '/customer/login.html';
            return;
        }

        this.setupEventListeners();
        this.loadProfile();
        this.loadOrders();
        
        const hash = window.location.hash.substring(1);
        const section = hash || 'profile';
        this.showSection(section);
    }

    //validate token if still valid
    async validateToken() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        } catch (error) {
            console.error('Token validation failed:', error);
            return false;
        }
    }

    //event listeners for profile page
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

        // Edit phone input formatting
        const editPhone = document.getElementById('editPhone');
        if (editPhone) {
            editPhone.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                
                if (value.startsWith('63')) {
                    value = '+' + value;
                } else if (value.startsWith('0')) {
                    value = value;
                } else if (value.length > 0) {
                    value = '+63' + value;
                }
                
                if (value.length > 13) {
                    value = value.substring(0, 13);
                }
                
                e.target.value = value;
            });
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

    //section id display
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

    //load user data
    async loadProfile() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) throw new Error('Failed to load profile');
            const data = await response.json();
            this.renderProfile(data);
        } catch (error) {
            console.error('Error loading profile:', error);
            alert('Error loading profile. Please log in again.');
            window.location.href = '/customer/login.html';
        }
    }

    //profile/user information
    renderProfile(profile) {
        document.getElementById('userName').textContent = profile.name || 'Not set';
        document.getElementById('userEmail').textContent = profile.email || 'Not set';
        document.getElementById('userPhone').textContent = profile.phone || 'Not set';
        document.getElementById('userAddress').textContent = profile.address || 'Not set';
    }

    //load user orders
    async loadOrders() {
        try {
            const response = await fetch(`${window.API_BASE_URL}/api/orders/user/me`, {
                headers: { 
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
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
            console.log('Orders data:', data);
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

    //list of orders
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

    //show or hide edit form
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

    //profile form submission
    async handleProfileSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('editName').value;
        const phone = document.getElementById('editPhone').value;
        const address = document.getElementById('editAddress').value;

        document.getElementById('nameError').textContent = '';
        document.getElementById('phoneError').textContent = '';
        document.getElementById('editName').classList.remove('is-invalid');
        document.getElementById('editPhone').classList.remove('is-invalid');

        let isValid = true;
        
        if (!name) {
            document.getElementById('nameError').textContent = 'Name is required';
            document.getElementById('editName').classList.add('is-invalid');
            isValid = false;
        }
        
        if (phone && !/^(\+63|0)9\d{9}$/.test(phone)) {
            document.getElementById('phoneError').textContent = 'Please enter a valid Philippine phone number (e.g., +639171234567 or 09171234567)';
            document.getElementById('editPhone').classList.add('is-invalid');
            isValid = false;
        }

        if (!isValid) return;

        try {
            const response = await fetch(`${window.API_BASE_URL}/api/auth/profile/update`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, phone, address })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }
            
            const data = await response.json();
            this.renderProfile(data);
            this.toggleEditForm(false);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            alert(`Error updating profile: ${error.message}`);
        }
    }

   //logout function
    handleLogout() {
        localStorage.removeItem('token');
        // Clear all localStorage to prevent any residual data
        localStorage.clear();
        // Prevent back button from showing cached page
        window.history.pushState(null, null, '/customer/login.html');
        window.location.href = '/customer/login.html';
        // Add event listener to prevent back navigation
        window.addEventListener('popstate', () => {
            window.location.href = '/customer/login.html';
        });
    }
}

// Instantiate the manager
const profileManager = new ProfileManager();