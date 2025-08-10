/**
 * Checkout Process with PayMongo Sandbox Integration
 * Handles payment method selection, delivery method, order creation, and payment processing
 */
class CheckoutManager {
    constructor() {
        this.cartItems = [];
        this.customerProfile = {};
        this.checkoutData = {
            paymentMethod: 'cash',
            deliveryMethod: 'pickup',
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

        window.addEventListener('beforeunload', (event) => {
        if (sessionStorage.getItem('pendingPayment') && this.checkoutData.paymentMethod === 'gcash') {
            event.preventDefault();
            event.returnValue = 'You have a pending payment. Navigating away may cancel your order. Are you sure?';
            }
        });
        // Clean up stale pending order/payment
        const pendingPayment = sessionStorage.getItem('pendingPayment');
        if (pendingPayment) {
            const { timestamp } = JSON.parse(pendingPayment);
            const now = Date.now();
            const timeout = 30 * 60 * 1000; // 30 minutes
            if (now - timestamp > timeout) {
                sessionStorage.removeItem('pendingPayment');
                sessionStorage.removeItem('pendingOrder');
                console.log('Cleared stale pending payment/order');
            }
        }

        // Add beforeunload listener for GCash payments
        window.addEventListener('beforeunload', (event) => {
            if (sessionStorage.getItem('pendingPayment') && this.checkoutData.paymentMethod === 'gcash') {
                event.preventDefault();
                event.returnValue = 'You have a pending payment. Navigating away may cancel your order. Are you sure?';
            }
        });
    }

    async loadCustomerProfile() {
        const token = localStorage.getItem('token');
        if (!token) {
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

    addProfileDataIndicators() {
        const profileDataFields = document.querySelectorAll('.profile-data');
        profileDataFields.forEach(field => {
            field.style.backgroundColor = '#f8f9fa';
            field.style.padding = '2px 5px';
            field.style.borderRadius = '3px';
        });
    }

    async loadCartItems() {
        const token = localStorage.getItem('token');
        if (!token) {
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
                    size: item.size || null
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
            <div class="text-center">
                <button type="button" class="btn btn-success btn-lg checkout-btn" onclick="checkoutManager.placeOrder()">
                     <i class="fas fa-check"></i> Place Order
                </button>
            </div>
        `;
        this.handlePaymentMethodChange('cash');
        this.handleDeliveryMethodChange('pickup');
    }

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

    handlePaymentMethodChange(method) {
        this.checkoutData.paymentMethod = method;
        console.log('Payment method selected:', method);
    }

    handleDeliveryMethodChange(method) {
        this.checkoutData.deliveryMethod = method;
        console.log('Delivery method selected:', method);
    }

    async placeOrder() {
        if (this.cartItems.length === 0) {
            alert('Your cart is empty. Please add items before placing an order.');
            return;
        }

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

        if (!this.checkoutData.paymentMethod || !this.checkoutData.deliveryMethod) {
            alert('Please select a payment and delivery method.');
            return;
        }

        // Prepare order items with sizeId if available
        const orderItems = this.cartItems.map(item => {
            const orderItem = {
                menuId: item.menuId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                size: item.size || null
            };

            // Add sizeId if size is selected
            if (item.sizeId) {
                orderItem.sizeId = item.sizeId;
            }

            return orderItem;
        });

        const totalAmount = orderItems.reduce((sum, item) => {
            return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
        }, 0);

        if (orderItems.length === 0 || totalAmount === 0) {
            console.error('Order validation failed:', { items: orderItems, total: totalAmount });
            alert('Cannot place order: No valid items or total amount is zero. Please check your cart.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('No authentication token found');

            // Disable checkout button to prevent duplicate submissions
            const checkoutBtn = document.querySelector('.btn.btn-success.btn-lg.checkout-btn');
            if (checkoutBtn) {
                checkoutBtn.disabled = true;
                checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            }

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

            console.log('Order request body:', JSON.stringify(orderRequestBody, null, 2));

            // Create the order first
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
                throw new Error(`Failed to create order: ${errorData.message || 'Unknown error'}`);
            }

            const orderData = await orderResponse.json();
            const orderId = orderData.orderId;

            // Handle payment method specific flows
            if (this.checkoutData.paymentMethod === 'gcash') {
                try {
                    // Create GCash payment source
                    const paymentResponse = await fetch('/api/payment/create-gcash-source', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            amount: totalAmount * 100, // Convert to centavos
                            description: `Order #${orderId}`,
                            orderId: orderId,
                            items: orderItems,
                            redirect: {
                                success: `${window.location.origin}/public/customer/success.html?orderId=${orderId}`,
                                failed: `${window.location.origin}/public/customer/failed.html?orderId=${orderId}`
                            }
                        })
                    });

                    const paymentData = await paymentResponse.json();
                    
                    if (!paymentResponse.ok) {
                        throw new Error(paymentData.error || 'Payment processing failed');
                    }

                    // Store payment verification data
                    sessionStorage.setItem('pendingPayment', JSON.stringify({
                        orderId: paymentData.orderId,
                        paymentId: paymentData.paymentId,
                        timestamp: Date.now()
                    }));

                    // Open Paymongo link in new tab
                    window.open(paymentData.checkoutUrl, '_blank');

                } catch (error) {
                    console.error('Payment error:', error);
                    alert(`Payment error: ${error.message}`);
                    throw error; // Re-throw to be caught by outer catch
                }
            } else {
                // For cash payments, redirect to success page
                window.location.href = `/public/customer/success.html?orderId=${orderId}`;
            }

        } catch (error) {
            console.error('Error placing order:', error);
            alert(`Error placing order: ${error.message}. Please try again.`);
            
            // Re-enable button if error occurs
            const checkoutBtn = document.querySelector('.btn.btn-success.btn-lg.checkout-btn');
            if (checkoutBtn) {
                checkoutBtn.disabled = false;
                checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
            }
        }
    }

    async handleReturnFromPaymongo() {
    const pendingPayment = sessionStorage.getItem('pendingPayment');
    const pendingOrder = sessionStorage.getItem('pendingOrder');
    if (!pendingPayment || !pendingOrder) return;

    try {
        const { paymentId } = JSON.parse(pendingPayment);
        const orderData = JSON.parse(pendingOrder);
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/public/customer/login.html';
            return;
        }

        // Verify payment status
        const response = await fetch(`/api/payments/verify-payment/${paymentId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();

        if (result.success && result.status === 'paid') {
            // Create order
            const orderResponse = await fetch('http://localhost:3000/api/orders/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...orderData,
                    paymentId,
                    status: 'paid',
                    payment_verified: true
                })
            });

            if (!orderResponse.ok) {
                const errorData = await orderResponse.json();
                throw new Error(`Failed to create order: ${errorData.message || 'Unknown error'}`);
            }

            const orderResult = await orderResponse.json();
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            window.location.href = `/public/customer/success.html?orderId=${orderResult.orderId}`;
        } else {
            // Payment not completed, clear pending data
            sessionStorage.removeItem('pendingPayment');
            sessionStorage.removeItem('pendingOrder');
            window.location.href = '/public/customer/failed.html';
        }
    } catch (error) {
        console.error('Error handling return from Paymongo:', error);
        sessionStorage.removeItem('pendingPayment');
        sessionStorage.removeItem('pendingOrder');
        alert('Error verifying payment status. Please try again.');
        window.location.href = '/public/customer/failed.html';
    }
}

    async placeOrder() {
    if (this.cartItems.length === 0) {
        alert('Your cart is empty. Please add items before placing an order.');
        return;
    }

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

    if (!this.checkoutData.paymentMethod || !this.checkoutData.deliveryMethod) {
        alert('Please select a payment and delivery method.');
        return;
    }

    // Prepare order items
    const orderItems = this.cartItems.map(item => ({
        menuId: item.menuId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size || null,
        sizeId: item.sizeId || null
    }));

    const totalAmount = orderItems.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);

    if (orderItems.length === 0 || totalAmount === 0) {
        console.error('Order validation failed:', { items: orderItems, total: totalAmount });
        alert('Cannot place order: No valid items or total amount is zero. Please check your cart.');
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('No authentication token found');

        // Disable checkout button
        const checkoutBtn = document.querySelector('.btn.btn-success.btn-lg.checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = true;
            checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        // Store order details temporarily in sessionStorage
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
        sessionStorage.setItem('pendingOrder', JSON.stringify(orderRequestBody));

        // Handle payment method specific flows
        if (this.checkoutData.paymentMethod === 'gcash') {
            try {
                // Create GCash payment source
                const paymentResponse = await fetch('/api/payment/create-gcash-source', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: totalAmount * 100, // Convert to centavos
                        description: `Pending Order`,
                        items: orderItems,
                        redirect: {
                            success: `${window.location.origin}/public/customer/success.html`,
                            failed: `${window.location.origin}/public/customer/failed.html`
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
                    timestamp: Date.now()
                }));

                // Open Paymongo link in new tab
                window.open(paymentData.checkoutUrl, '_blank');

            } catch (error) {
                console.error('Payment error:', error);
                alert(`Payment error: ${error.message}`);
                sessionStorage.removeItem('pendingOrder');
                throw error;
            }
        } else {
            // For cash payments, create order immediately
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
                throw new Error(`Failed to create order: ${errorData.message || 'Unknown error'}`);
            }

            const orderData = await orderResponse.json();
            sessionStorage.removeItem('pendingOrder');
            window.location.href = `/public/customer/success.html?orderId=${orderData.orderId}`;
        }

    } catch (error) {
        console.error('Error placing order:', error);
        alert(`Error placing order: ${error.message}. Please try again.`);
        sessionStorage.removeItem('pendingOrder');

        // Re-enable button
        const checkoutBtn = document.querySelector('.btn.btn-success.btn-lg.checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
        }
    }
}

    // Method to cancel an order
    async cancelOrder(orderId) {
        // Verify token and user authorization
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/public/customer/login.html';
            return;
        }

        try {
            // Send request to cancel the order
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

const checkoutManager = new CheckoutManager();