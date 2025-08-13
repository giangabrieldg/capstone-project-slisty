/**
 * CheckoutManager class handles the checkout process with PayMongo integration.
 * Manages cart items, customer profile, payment/delivery methods, and order processing.
 */
class CheckoutManager {
    constructor() {
        // Initialize state
        this.cartItems = []; // Array to store cart items
        this.customerProfile = {}; // Object to store customer profile data
        this.checkoutData = {
            paymentMethod: 'cash', // Default payment method
            deliveryMethod: 'pickup', // Default delivery method
            customerInfo: {}, // Customer info for order
            orderDetails: {} // Order details for submission
        };
        this.init(); // Initialize the checkout process
    }

    /**
     * Initializes the checkout process, sets up event listeners, and checks for payment return.
     */
    init() {
    console.log('Initializing checkout manager...');
    this.loadCartItems();
    this.loadCustomerProfile();
    this.setupEventListeners();
    this.renderCheckoutForm();

    // Clean up stale pending order/payment data
    const pendingPayment = sessionStorage.getItem('pendingPayment');
    if (pendingPayment) {
        const { timestamp } = JSON.parse(pendingPayment);
        const now = Date.now();
        const timeout = 30 * 60 * 1000; // 30 minutes
        if (now - timestamp > timeout) {
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            console.log('Cleared stale pending payment/order');
        } else if (window.location.pathname.includes('checkout.html')) {
            console.log('Pending payment detected, checking status...');
            this.handleReturnFromPaymongo(); // Check immediately
            this.startPaymentPolling();
        }
    }

    // Trigger payment verification if on success.html
    if (window.location.pathname.includes('success.html')) {
        console.log('Detected success.html, running handleReturnFromPaymongo');
        this.handleReturnFromPaymongo();
    }

    // Add beforeunload listener
    window.addEventListener('beforeunload', (event) => {
        if (sessionStorage.getItem('pendingPayment') && this.checkoutData.paymentMethod === 'gcash') {
            event.preventDefault();
            event.returnValue = 'You have a pending payment. Navigating away may cancel your order. Are you sure?';
        }
    });
}

    /**
     * Starts polling to check payment status and handle return flow.
     */
    startPaymentPolling() {
    const pollInterval = setInterval(async () => {
        const pendingPayment = sessionStorage.getItem('pendingPayment');
        if (!pendingPayment) {
            clearInterval(pollInterval);
            return;
        }

        console.log('Polling payment status...');
        const statusMessage = document.getElementById('paymentStatusMessage');
        if (statusMessage) {
            document.getElementById('paymentStatusText').textContent = 'Checking payment status...';
        }

        try {
            await this.handleReturnFromPaymongo();
            if (!sessionStorage.getItem('pendingPayment')) {
                clearInterval(pollInterval);
                if (statusMessage) {
                    statusMessage.classList.add('d-none');
                    statusMessage.classList.remove('show');
                }
            }
        } catch (error) {
            console.error('Polling error:', error);
            const statusMessage = document.getElementById('paymentStatusMessage');
            if (statusMessage) {
                statusMessage.classList.add('alert-danger', 'show');
                statusMessage.classList.remove('d-none', 'alert-info');
                document.getElementById('paymentStatusText').textContent = 
                    'Error checking payment status. Retrying...';
            }
            // Stop polling after multiple failures (e.g., 5 minutes)
            const { timestamp } = JSON.parse(pendingPayment);
            if (Date.now() - timestamp > 5 * 60 * 1000) {
                clearInterval(pollInterval);
                sessionStorage.removeItem('pendingPayment');
                sessionStorage.removeItem('pendingOrder');
                window.location.href = '/public/customer/failed.html';
            }
        }
    }, 5000); // Poll every 5 seconds
}

    /**
     * Loads customer profile from the server.
     */
    async loadCustomerProfile() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
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
     * Renders customer profile information in the checkout form.
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
     * Styles profile data fields for better visibility.
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
     * Loads cart items from the server and validates them.
     */
    async loadCartItems() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/cart', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Failed to load cart: ${response.statusText}`);
            
            const data = await response.json();
            console.log('Raw cart data:', JSON.stringify(data, null, 2));
            
            this.cartItems = (data.cartItems || []).map(item => {
                let price = 0;
                const menuItem = item.MenuItem || {};
                if (menuItem.hasSizes && item.size && Array.isArray(menuItem.sizes)) {
                    const normalizedSize = item.size?.trim().toLowerCase();
                    const selectedSize = menuItem.sizes.find(
                        s => s.sizeName?.trim().toLowerCase() === normalizedSize
                    );
                    if (selectedSize) {
                        price = parseFloat(selectedSize.price) || 0;
                        console.log(`Found size ${item.size} for ${menuItem.name}: ₱${price}`);
                    } else {
                        console.warn(`Size ${item.size} not found for ${menuItem.name}`, menuItem.sizes);
                    }
                } else {
                    price = parseFloat(String(menuItem.basePrice)) || 0;
                    console.log(`Using basePrice for ${menuItem.name}: ₱${price}`);
                }
                return {
                    menuId: item.menuId,
                    name: menuItem.name || 'Unknown Item',
                    price,
                    quantity: Number(item.quantity) || 0,
                    size: item.size || null,
                    sizeId: item.sizeId || null
                };
            }).filter(item => {
                const isValid = item.menuId && item.name !== 'Unknown Item' && item.quantity > 0;
                if (!isValid || item.price === 0) {
                    console.warn('Invalid cart item or zero price:', item);
                }
                return isValid;
            });

            console.log('Validated cart items:', JSON.stringify(this.cartItems, null, 2));
            this.renderCartSummary();
        } catch (error) {
            console.error('Error loading cart:', error);
            alert('Error loading cart items. Please try again.');
            this.renderCartSummary();
        }
    }

    /**
     * Sets up event listeners for payment and delivery method changes.
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
     * Binds events to payment and delivery method radio buttons.
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
     * Renders the checkout form with payment and delivery options.
     */
    renderCheckoutForm() {
        const checkoutForm = document.getElementById('checkoutForm');
        if (!checkoutForm) return;

        checkoutForm.innerHTML = `
            <div class="card mb-4">
                <div class="card-header bg-primary text-white">
                    <h5 class="mb-0"><i class="fas fa-credit-card"></i> Payment Method</h5>
                </div>
                <div class="card-body">
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="radio" name="paymentMethod" 
                               id="cash" value="cash" checked>
                        <label class="form-check-label" for="cash">
                            <i class="fas fa-money-bill-wave"></i> Cash on Delivery/Pickup
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="paymentMethod" 
                               id="gcash" value="gcash">
                        <label class="form-check-label" for="gcash">
                            <i class="fas fa-mobile-alt"></i> GCash (PayMongo)
                        </label>
                    </div>
                </div>
            </div>
            <div class="card mb-4">
                <div class="card-header bg-info text-white">
                    <h5 class="mb-0"><i class="fas fa-shipping-fast"></i> Delivery Method</h5>
                </div>
                <div class="card-body">
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="radio" name="deliveryMethod" 
                               id="pickup" value="pickup" checked>
                        <label class="form-check-label" for="pickup">
                            <i class="fas fa-store"></i> Store Pickup
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="deliveryMethod" 
                               id="delivery" value="delivery">
                        <label class="form-check-label" for="delivery">
                            <i class="fas fa-truck"></i> Home Delivery
                        </label>
                    </div>
                </div>
            </div>
            <div class="card mb-4">
                <div class="card-header bg-warning text-dark">
                    <h5 class="mb-0"><i class="fas fa-user"></i> Customer Information</h5>
                </div>
                <div class="card-body" id="customerInfoContainer">
                    <p>Loading profile information...</p>
                </div>
            </div>
            <div class="card mb-4">
                <div class="card-header bg-success text-white">
                    <h5 class="mb-0"><i class="fas fa-list"></i> Order Summary</h5>
                </div>
                <div class="card-body">
                    <div id="cartSummary"></div>
                    <hr>
                    <div class="d-flex justify-content-between">
                        <h5>Total:</h5>
                        <h5 id="orderTotal">₱0.00</h5>
                    </div>
                </div>
            </div>
            <div id="paymentStatusMessage" class="alert alert-info d-none mb-3">
                <i class="fas fa-info-circle"></i> <span id="paymentStatusText">Processing payment...</span>
            </div>
            <div class="text-center">
                <button type="button" class="btn btn-success btn-lg checkout-btn" onclick="checkoutManager.placeOrder()">
                     <i class="fas fa-check"></i> Place Order
                </button>
            </div>
        `;
        this.handlePaymentMethodChange('cash');
        this.handleDeliveryMethodChange('pickup');
    }

    /**
     * Renders the cart summary and total in the checkout form.
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
     * Updates the payment method in checkoutData.
     * @param {string} method - Selected payment method (cash or gcash).
     */
    handlePaymentMethodChange(method) {
        this.checkoutData.paymentMethod = method;
        console.log('Payment method selected:', method);
    }

    /**
     * Updates the delivery method in checkoutData.
     * @param {string} method - Selected delivery method (pickup or delivery).
     */
    handleDeliveryMethodChange(method) {
        this.checkoutData.deliveryMethod = method;
        console.log('Delivery method selected:', method);
    }

    /**
     * Handles order placement and payment processing.
     */
    /**
 * Handles the entire order placement process including:
 * - Validating cart and customer info
 * - Preparing order data
 * - Processing payments (cash or GCash)
 * - Managing the PayMongo payment flow
 * - Handling success/failure cases
 */
async placeOrder() {
    // =============================================
    // SECTION 1: VALIDATION CHECKS
    // =============================================
    
    // Validate cart isn't empty
    if (this.cartItems.length === 0) {
        alert('Your cart is empty. Please add items before placing an order.');
        return;
    }

    // Validate required customer profile fields
    const profile = this.customerProfile;
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !profile[field]);
    
    if (missingFields.length > 0) {
        alert(`Please complete your profile (${missingFields.join(', ')}) before placing an order.`);
        window.location.href = '/public/customer/profile.html';
        return;
    }

    // Validate delivery address if needed
    if (this.checkoutData.deliveryMethod === 'delivery' && !profile.address) {
        alert('Please provide a delivery address in your profile for home delivery.');
        window.location.href = '/public/customer/profile.html';
        return;
    }

    // =============================================
    // SECTION 2: PREPARE ORDER DATA
    // =============================================

    // Transform cart items for the order
    const orderItems = this.cartItems.map(item => ({
        menuId: item.menuId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size || null,
        sizeId: item.sizeId || null
    }));

    // Calculate total amount
    const totalAmount = orderItems.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);

    // Validate order total
    if (totalAmount <= 0) {
        console.error('Invalid order total:', totalAmount);
        alert('Cannot place order: Total amount must be greater than zero.');
        return;
    }

    // =============================================
    // SECTION 3: PAYMENT PROCESSING
    // =============================================

    const token = localStorage.getItem('token');
    if (!token) {
        alert('Session expired. Please login again.');
        window.location.href = '/public/customer/login.html';
        return;
    }

    try {
        // Disable checkout button to prevent duplicate submissions
        const checkoutBtn = document.querySelector('.checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        // Show payment status message
        const statusMessage = document.getElementById('paymentStatusMessage');
        if (statusMessage) {
            statusMessage.classList.remove('d-none');
            statusMessage.classList.add('show');
        }

        // Prepare order request payload
        const orderRequestBody = {
            items: orderItems,
            totalAmount: totalAmount,
            paymentMethod: this.checkoutData.paymentMethod,
            deliveryMethod: this.checkoutData.deliveryMethod,
            customerInfo: {
                fullName: profile.name,
                email: profile.email,
                phone: profile.phone,
                deliveryAddress: this.checkoutData.deliveryMethod === 'delivery' ? profile.address : null
            }
        };

        // Store order temporarily in session storage
        sessionStorage.setItem('pendingOrder', JSON.stringify(orderRequestBody));

        // =============================================
        // SECTION 4: GCASH PAYMENT FLOW
        // =============================================
        if (this.checkoutData.paymentMethod === 'gcash') {
            console.log('Initiating GCash payment flow...');

            // Define redirect URLs (using current origin)
            const successUrl = `${window.location.origin}/public/customer/success.html`;
            const failedUrl = `${window.location.origin}/public/customer/failed.html`;

            try {
                // Create GCash payment source via API
                const paymentResponse = await fetch('/api/payment/create-gcash-source', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: totalAmount * 100, // Convert to centavos
                        description: `Order Payment`,
                        items: orderItems,
                        redirect: {
                            success: successUrl,
                            failed: failedUrl
                        }
                    })
                });

                const paymentData = await paymentResponse.json();
                if (!paymentResponse.ok) {
                    throw new Error(paymentData.error || 'Payment processing failed');
                }

                // Store payment verification data
                sessionStorage.setItem('pendingPayment', JSON.stringify({
                    paymentId: paymentData.paymentId,
                    sourceId: paymentData.sourceId,
                    timestamp: Date.now(),
                    paymentMethod: 'gcash'
                }));

                // Open payment window with specific dimensions
                const paymentWindow = window.open(
                    paymentData.checkoutUrl,
                    'GCashPayment',
                    'width=500,height=800,scrollbars=yes'
                );

                // Start polling for payment status
                this.startPaymentPolling();

                // Focus on the payment window if possible
                if (paymentWindow) {
                    paymentWindow.focus();
                }

                // Update UI status
                if (statusMessage) {
                    document.getElementById('paymentStatusText').textContent = 
                        'Please complete the GCash payment in the popup window...';
                }

            } catch (error) {
                console.error('GCash payment initiation failed:', error);
                alert(`Payment error: ${error.message}`);
                
                // Clean up session storage
                sessionStorage.removeItem('pendingOrder');
                sessionStorage.removeItem('pendingPayment');
                
                // Reset UI
                if (checkoutBtn) {
                    checkoutBtn.disabled = false;
                    checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
                }
                
                if (statusMessage) {
                    statusMessage.classList.add('d-none');
                    statusMessage.classList.remove('show');
                }
                
                throw error;
            }
            
        } 
        // =============================================
        // SECTION 5: CASH PAYMENT FLOW
        // =============================================
        else {
            console.log('Processing cash payment...');
            
            // Submit order immediately for cash payments
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
                throw new Error(errorData.message || 'Failed to create order');
            }

            const orderData = await orderResponse.json();
            
            // Clear pending order data
            sessionStorage.removeItem('pendingOrder');
            
            // Redirect to success page
            window.location.href = `/public/customer/success.html?orderId=${orderData.orderId}`;
        }

    } catch (error) {
        console.error('Order placement failed:', error);
        alert(`Order failed: ${error.message}. Please try again.`);
        
        // Re-enable checkout button
        const checkoutBtn = document.querySelector('.checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
        }
        
        // Hide status message
        const statusMessage = document.getElementById('paymentStatusMessage');
        if (statusMessage) {
            statusMessage.classList.add('d-none');
            statusMessage.classList.remove('show');
        }
    }
}

    /**
 * Handles the return flow from PayMongo payment:
 * 1. Checks for pending payment data
 * 2. Verifies payment status with backend
 * 3. Creates order if payment succeeded
 * 4. Redirects to appropriate page (success/failed)
 * 5. Cleans up session storage
 */
async handleReturnFromPaymongo() {
    const pendingPayment = sessionStorage.getItem('pendingPayment');
    const pendingOrder = sessionStorage.getItem('pendingOrder');
    if (!pendingPayment || !pendingOrder) return;

    try {
        const { paymentId } = JSON.parse(pendingPayment);
        const orderData = JSON.parse(pendingOrder);
        const token = localStorage.getItem('token');

        // Verify payment status
        const response = await fetch(`/api/payment/verify-payment/${paymentId}`, { // Changed /payments to /payment
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (!response.ok) {
            if (response.status === 404) {
                console.error(`Payment verification endpoint not found for paymentId: ${paymentId}`);
                const statusMessage = document.getElementById('paymentStatusMessage');
                if (statusMessage) {
                    statusMessage.classList.add('alert-warning', 'show');
                    statusMessage.classList.remove('d-none', 'alert-info');
                    document.getElementById('paymentStatusText').textContent = 
                        'Payment verification in progress, please wait...';
                }
                return; // Let polling continue
            }
            throw new Error(result.error || 'Payment verification failed');
        }

        // Handle payment result
        if (result.success && result.status === 'paid') {
            // Create confirmed order
            const orderResponse = await fetch('/api/orders/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...orderData,
                    paymentId,
                    status: 'paid'
                })
            });

            if (!orderResponse.ok) {
                throw new Error('Failed to create order');
            }

            const orderResult = await orderResponse.json();
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            window.location.href = `/public/customer/success.html?orderId=${orderResult.orderId}`;
        } else if (result.status === 'failed' || result.status === 'expired') {
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            window.location.href = '/public/customer/failed.html';
        } else {
            // Payment still pending
            const statusMessage = document.getElementById('paymentStatusMessage');
            if (statusMessage) {
                document.getElementById('paymentStatusText').textContent = 
                    'Awaiting payment confirmation...';
            }
        }
    } catch (error) {
        console.error('Payment verification failed:', error);
        const statusMessage = document.getElementById('paymentStatusMessage');
        if (statusMessage) {
            statusMessage.classList.add('alert-danger', 'show');
            statusMessage.classList.remove('d-none', 'alert-info');
            document.getElementById('paymentStatusText').textContent = 
                `Error: ${error.message}. Please try again or contact support.`;
        }
        // Delay redirect to allow webhook to process
        setTimeout(() => {
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            window.location.href = '/public/customer/failed.html';
        }, 30000); // Wait 30 seconds
    }
}
    /**
     * Cancels an order by ID.
     * @param {string} orderId - The ID of the order to cancel.
     */
    async cancelOrder(orderId) {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            const response = await fetch(`/api/orders/cancel/${orderId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to cancel order');
            const result = await response.json();
            console.log('Order canceled:', result.message);
            alert('Order has been canceled.');
            window.location.href = '/public/customer/cart.html';
        } catch (error) {
            console.error('Error canceling order:', error);
            alert('Error canceling order. Please try again.');
        }
    }
}

// Instantiate the CheckoutManager
const checkoutManager = new CheckoutManager();