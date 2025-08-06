/**
 * Checkout Process with PayMongo Sandbox Integration
 * This script handles the complete checkout flow including:
 * - Payment method selection (Cash/GCash)
 * - Delivery method selection (Pickup/Delivery)
 * - Order creation and payment processing
 * - Integration with PayMongo sandbox for GCash payments
 * - Displaying non-editable customer information from profile
 */

class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.customerProfile = {};
        this.checkoutData = {
            paymentMethod: null,
            deliveryMethod: null,
            customerInfo: {},
            orderDetails: {}
        };
        this.init();
    }

    init() {
        console.log('Initializing checkout manager...');
        this.loadCartItems();
        this.loadCustomerProfile();
        this.setupEventListeners();
        this.renderCheckoutForm();
    }

    /**
     * Load customer profile from server
     * Fetches current user's profile data to display in checkout
     */
    async loadCustomerProfile() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load profile');
            
            const data = await response.json();
            this.customerProfile = data || {};
            console.log('Customer profile loaded:', this.customerProfile);
            this.renderCustomerInfo();
        } catch (error) {
            console.error('Error loading customer profile:', error);
            alert('Error loading profile. Please update your profile and try again.');
            window.location.href = '/public/customer/profile.html';
        }
    }

    /**
     * Render customer information from profile
     */
    renderCustomerInfo() {
        const customerInfoContainer = document.getElementById('customerInfoContainer');
        if (!customerInfoContainer || !this.customerProfile) return;

        const profile = this.customerProfile;
        customerInfoContainer.innerHTML = `
            <div class="mb-3">
                <strong>Full Name:</strong> <span class="profile-data">${profile.name || 'Not set'}</span>
            </div>
            <div class="mb-3">
                <strong>Email Address:</strong> <span class="profile-data">${profile.email || 'Not set'}</span>
            </div>
            <div class="mb-3">
                <strong>Phone Number:</strong> <span class="profile-data">${profile.phone || 'Not set'}</span>
            </div>
            <div class="mb-3">
                <strong>Delivery Address:</strong> <span class="profile-data">${profile.address || 'Not set'}</span>
            </div>
            <div class="text-center">
                <a href="/public/customer/profile.html" class="btn btn-outline-primary btn-sm">
                    <i class="fas fa-edit"></i> Update Profile
                </a>
            </div>
        `;
        this.addProfileDataIndicators();
    }

    /**
     * Add visual indicators for profile data
     */
    addProfileDataIndicators() {
        const profileDataFields = document.querySelectorAll('.profile-data');
        profileDataFields.forEach(field => {
            field.style.backgroundColor = '#f8f9fa';
            field.style.padding = '2px 5px';
            field.style.borderRadius = '3px';
        });
    }

    /**
     * Load cart items from server
     * Fetches current user's cart items from the backend
     */
    async loadCartItems() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/cart', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to load cart');
            
            const data = await response.json();
            console.log('Raw cart data:', data);
            
            // Transform cart items to match expected structure
            this.cartItems = (data.cartItems || []).map(item => {
                let price = 0;
                const priceStr = item.MenuItem?.price || '0';
                if (item.size) {
                    try {
                        const priceObj = JSON.parse(priceStr);
                        price = Number(priceObj[item.size]) || 0;
                    } catch {
                        price = 0;
                    }
                } else {
                    price = Number(priceStr) || 0;
                }
                return {
                    menuId: item.menuId,
                    name: item.MenuItem?.name || 'Unknown Item',
                    price: price,
                    quantity: Number(item.quantity) || 0,
                    size: item.size || null
                };
            }).filter(item => {
                const isValid = item.menuId && item.name !== 'Unknown Item' && item.price > 0 && item.quantity > 0;
                if (!isValid) {
                    console.warn('Invalid cart item:', item);
                }
                return isValid;
            });

            console.log('Validated cart items:', this.cartItems);
            this.renderCartSummary();
        } catch (error) {
            console.error('Error loading cart:', error);
            alert('Error loading cart items. Please try again.');
            this.renderCartSummary();
        }
    }

    /**
     * Setup event listeners for checkout form
     * Handles payment and delivery method interactions
     */
    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.bindEvents();
                this.renderCustomerInfo();
            });
        } else {
            this.bindEvents();
            this.renderCustomerInfo();
        }
    }

    /**
     * Bind events to form elements
     */
    bindEvents() {
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handlePaymentMethodChange(e.target.value);
            });
        });

        const deliveryMethods = document.querySelectorAll('input[name="deliveryMethod"]');
        deliveryMethods.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.handleDeliveryMethodChange(e.target.value);
            });
        });
    }

    /**
     * Render the complete checkout form
     * Includes payment method, delivery method, and non-editable customer info
     */
    renderCheckoutForm() {
        const checkoutForm = document.getElementById('checkoutForm');
        if (!checkoutForm) return;

        checkoutForm.innerHTML = `
            <!-- Payment Method Selection -->
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="fas fa-credit-card"></i> Payment Method</h5>
                </div>
                <div class="card-body">
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="radio" name="paymentMethod" 
                               id="cash" value="cash" checked onchange="checkoutManager.handlePaymentMethodChange(this.value)">
                        <label class="form-check-label" for="cash">
                            <i class="fas fa-money-bill-wave"></i> Cash on Delivery/Pickup
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="paymentMethod" 
                               id="gcash" value="gcash" onchange="checkoutManager.handlePaymentMethodChange(this.value)">
                        <label class="form-check-label" for="gcash">
                            <i class="fas fa-mobile-alt"></i> GCash (PayMongo)
                        </label>
                    </div>
                </div>
            </div>

            <!-- Delivery Method Selection -->
            <div class="card mb-4">
                <div class="card-header bg-info text-white">
                    <h5 class="mb-0"><i class="fas fa-shipping-fast"></i> Delivery Method</h5>
                </div>
                <div class="card-body">
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="radio" name="deliveryMethod" 
                               id="pickup" value="pickup" checked onchange="checkoutManager.handleDeliveryMethodChange(this.value)">
                        <label class="form-check-label" for="pickup">
                            <i class="fas fa-store"></i> Store Pickup
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="deliveryMethod" 
                               id="delivery" value="delivery" onchange="checkoutManager.handleDeliveryMethodChange(this.value)">
                        <label class="form-check-label" for="delivery">
                            <i class="fas fa-truck"></i> Home Delivery
                        </label>
                    </div>
                </div>
            </div>

            <!-- Customer Information -->
            <div class="card mb-4">
                <div class="card-header bg-warning text-dark">
                    <h5 class="mb-0"><i class="fas fa-user"></i> Customer Information</h5>
                </div>
                <div class="card-body" id="customerInfoContainer">
                    <!-- Profile data will be rendered here -->
                    <p>Loading profile information...</p>
                </div>
            </div>

            <!-- Order Summary -->
            <div class="card mb-4">
                <div class="card-header bg-success text-white">
                    <h5 class="mb-0"><i class="fas fa-list"></i> Order Summary</h5>
                </div>
                <div class="card-body">
                    <div id="cartSummary">
                        <!-- Cart items will be rendered here -->
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between">
                        <h5>Total:</h5>
                        <h5 id="orderTotal">₱0.00</h5>
                    </div>
                </div>
            </div>

            <!-- Place Order Button -->
            <div class="text-center">
                <button type="button" class="btn btn-success btn-lg" onclick="checkoutManager.placeOrder()">
                    <i class="fas fa-check"></i> Place Order
                </button>
            </div>
        `;
    }

    /**
     * Render cart summary
     */
    renderCartSummary() {
        const cartSummary = document.getElementById('cartSummary');
        const orderTotal = document.getElementById('orderTotal');
        if (!cartSummary || !orderTotal) return;

        if (this.cartItems.length === 0) {
            cartSummary.innerHTML = '<p>Your cart is empty.</p>';
            orderTotal.textContent = '₱0.00';
            return;
        }

        cartSummary.innerHTML = this.cartItems.map(item => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            const name = item.name || 'Unknown Item';
            return `
                <div class="d-flex justify-content-between mb-2">
                    <span>${name}${item.size ? ` (${item.size})` : ''} x${quantity}</span>
                    <span>₱${(price * quantity).toFixed(2)}</span>
                </div>
            `;
        }).join('');

        const total = this.cartItems.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 0;
            return sum + price * quantity;
        }, 0);

        orderTotal.textContent = `₱${total.toFixed(2)}`;
    }

    /**
     * Handle payment method change
     * @param {string} method - Selected payment method
     */
    handlePaymentMethodChange(method) {
        this.checkoutData.paymentMethod = method;
        console.log('Payment method selected:', method);
    }

    /**
     * Handle delivery method change
     * @param {string} method - Selected delivery method
     */
    handleDeliveryMethodChange(method) {
        this.checkoutData.deliveryMethod = method;
        console.log('Delivery method selected:', method);
    }

    /**
     * Place order and process payment
     */
    async placeOrder() {
        // Validate cart
        if (this.cartItems.length === 0) {
            alert('Your cart is empty. Please add items before placing an order.');
            return;
        }

        // Validate required profile fields
        const profile = this.customerProfile;
        if (!profile.name || !profile.email || !profile.phone) {
            alert('Please complete your profile (Name, Email, Phone) before placing an order.');
            window.location.href = '/public/customer/profile.html';
            return;
        }
        if (this.checkoutData.deliveryMethod === 'delivery' && !profile.address) {
            alert('Please provide a delivery address in your profile for home delivery.');
            window.location.href = '/public/customer/profile.html';
            return;
        }

        this.checkoutData.customerInfo = {
            fullName: profile.name,
            email: profile.email,
            phone: profile.phone,
            deliveryAddress: profile.address || ''
        };

        // Transform cart items for order creation
        const orderItems = this.cartItems.map(item => ({
            menuId: item.menuId,
            name: item.name || 'Unknown Item',
            size: item.size || null,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0
        }));

        this.checkoutData.orderDetails = {
            items: orderItems,
            total: orderItems.reduce((sum, item) => {
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                return sum + price * quantity;
            }, 0)
        };

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            // Log request body for debugging
            const orderRequestBody = {
                items: this.checkoutData.orderDetails.items,
                totalAmount: this.checkoutData.orderDetails.total,
                paymentMethod: this.checkoutData.paymentMethod,
                deliveryMethod: this.checkoutData.deliveryMethod,
                customerInfo: this.checkoutData.customerInfo
            };
            console.log('Order request body:', orderRequestBody);

            // Create order
            const orderResponse = await fetch('http://localhost:3000/api/orders/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderRequestBody)
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json();
                console.error('Order creation error response:', errorData);
                throw new Error(`Failed to create order: ${errorData.message || 'Unknown error'}`);
            }
            const orderData = await orderResponse.json();
            const orderId = orderData.orderId;

            if (this.checkoutData.paymentMethod === 'gcash') {
                const paymentResponse = await fetch('http://localhost:3000/api/payment/create-gcash-source', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: this.checkoutData.orderDetails.total * 100, // PayMongo expects amount in centavos
                        description: 'Slice N Grind Order',
                        orderId: orderId,
                        redirect: {
                            success: 'http://localhost:3000/public/customer/success.html',
                            failed: 'http://localhost:3000/public/customer/failed.html'
                        }
                    })
                });

                if (!paymentResponse.ok) {
                    const paymentErrorData = await paymentResponse.json();
                    throw new Error(`Failed to create payment: ${paymentErrorData.message || 'Unknown error'}`);
                }
                const paymentData = await paymentResponse.json();
                window.location.href = paymentData.checkoutUrl;
            } else {
                window.location.href = '/public/customer/success.html';
            }
        } catch (error) {
            console.error('Error placing order:', error);
            alert(`Error placing order: ${error.message}. Please try again.`);
        }
    }
}

// Instantiate the manager
const checkoutManager = new CheckoutManager();