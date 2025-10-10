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
      paymentMethod: 'gcash', // Default payment method
      deliveryMethod: 'pickup', // Default delivery method
      customerInfo: {}, // Customer info for order
      orderDetails: {}, // Order details for submission
      pickupDate: null // Store selected pickup/delivery date
    };
    this.init(); // Initialize the checkout process
  }

  /**
   * Initializes the checkout process, sets up event listeners, and checks for payment return.
   */
  init() {
    console.log('Initializing checkout manager...');

    this.isCustomCakeCheckout = this.checkForCustomCake();
  
    if (this.isCustomCakeCheckout) {
      this.loadCustomCakeOrder();
    } else {
        this.loadCartItems();
    }

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

    // Add beforeunload listener to warn about pending payments
    window.addEventListener('beforeunload', (event) => {
      if (sessionStorage.getItem('pendingPayment') && this.checkoutData.paymentMethod === 'gcash') {
        event.preventDefault();
        event.returnValue = 'You have a pending payment. Navigating away may cancel your order. Are you sure?';
      }
    });
  }

    checkForCustomCake() {
    const urlParams = new URLSearchParams(window.location.search);
    this.customCakeData = {
      customCakeId: urlParams.get('customCakeId'),
      isImageOrder: urlParams.get('isImageOrder') === 'true',
      amount: parseFloat(urlParams.get('amount'))
    };
    
    return !!this.customCakeData.customCakeId;
  }

  //load custom cake order details
async loadCustomCakeOrder() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    // Use correct endpoint based on order type
    const endpoint = this.customCakeData.isImageOrder 
      ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${this.customCakeData.customCakeId}`
      : `${window.API_BASE_URL}/api/custom-cake/${this.customCakeData.customCakeId}`;
    
    const response = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Failed to load custom cake order');
    
    const data = await response.json();
    this.customCakeOrder = data.order;

    console.log('Loaded custom cake order details:', {
      order: this.customCakeOrder,
      price: this.customCakeOrder.price,
      type: typeof this.customCakeOrder.price,
      downpayment_amount: this.customCakeOrder.downpayment_amount,
      remaining_balance: this.customCakeOrder.remaining_balance
    });

    // Check if price is properly set
    if (!this.customCakeOrder.price || this.customCakeOrder.price <= 0) {
      console.error('Order price not set or invalid:', this.customCakeOrder.price);
      alert('This order does not have a valid price set. Please contact the bakery.');
      window.location.href = '/customer/custom-orders.html';
      return;
    }
    
    // FIXED: Determine payment type based on order type and current status
    let isDownpayment = false;
    let paymentAmount = this.customCakeOrder.price;
    
    // For image-based orders, accept both "Feasible" and "Ready for Downpayment"
    const validDownpaymentStatuses = this.customCakeData.isImageOrder 
      ? ['Feasible', 'Ready for Downpayment']
      : ['Ready for Downpayment'];
    
    if (validDownpaymentStatuses.includes(this.customCakeOrder.status)) {
      // First payment - downpayment flow
      isDownpayment = true;
      // Use downpayment_amount if set, otherwise calculate 50%
      paymentAmount = this.customCakeOrder.downpayment_amount || (this.customCakeOrder.price * 0.5);
      
    } else if (this.customCakeOrder.status === 'Downpayment Paid') {
      // Second payment - remaining balance
      isDownpayment = false;
      paymentAmount = this.customCakeOrder.remaining_balance || (this.customCakeOrder.price * 0.5);
      
    } else {
      // Invalid status for checkout
      console.error('Invalid order status for checkout:', this.customCakeOrder.status);
      alert(`This order is not ready for payment. Current status: ${this.customCakeOrder.status}`);
      window.location.href = '/customer/custom-orders.html';
      return;
    }
    
    // Update custom cake data with payment info
    this.customCakeData.amount = paymentAmount;
    this.customCakeData.isDownpayment = isDownpayment;
    this.customCakeData.totalPrice = this.customCakeOrder.price;
    this.customCakeData.downpaymentAmount = this.customCakeOrder.downpayment_amount || (this.customCakeOrder.price * 0.5);
    this.customCakeData.remainingBalance = this.customCakeOrder.remaining_balance || (this.customCakeOrder.price * 0.5);
    
   // Create mock cart item for display - FIX data types
const paymentLabel = isDownpayment ? '50% Downpayment' : 'Final Payment (50%)';
const orderType = this.customCakeData.isImageOrder ? 'Custom Image Cake' : '3D Custom Cake';

// Ensure all prices are numbers
const totalPrice = parseFloat(this.customCakeOrder.price) || 0;
const downpaymentAmount = parseFloat(this.customCakeData.downpaymentAmount) || (totalPrice * 0.5);
const remainingBalance = parseFloat(this.customCakeData.remainingBalance) || (totalPrice * 0.5);

this.cartItems = [{
  menuId: null,
  name: `${orderType} - ${paymentLabel}`,
  price: paymentAmount, // This is already calculated as downpayment or final amount
  quantity: 1,
  size: this.customCakeOrder.size || 'Custom',
  isCustomCake: true,
  customCakeId: this.customCakeData.customCakeId,
  isImageOrder: this.customCakeData.isImageOrder,
  isDownpayment: isDownpayment,
  totalPrice: totalPrice, // Ensure it's a number
  downpaymentAmount: downpaymentAmount,
  remainingBalance: remainingBalance
}];

console.log('Cart items created:', this.cartItems);
    
    this.renderCartSummary();
    
  } catch (error) {
  console.error('Error loading custom cake order:', {
    error: error.message,
    customCakeId: this.customCakeData.customCakeId,
    isImageOrder: this.customCakeData.isImageOrder
  });
    alert('Error loading custom cake order. Please try again.');
    return;
  }
}
  /**
   * Starts polling to check payment status and handle return flow.
   */
  startPaymentPolling() {
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes (60 * 5 seconds)
    
    const pollInterval = setInterval(async () => {
      pollCount++;
      
      const pendingPayment = sessionStorage.getItem('pendingPayment');
      if (!pendingPayment || pollCount >= maxPolls) {
        clearInterval(pollInterval);
        
        if (pollCount >= maxPolls) {
          console.warn('Polling timeout reached');
          const statusMessage = document.getElementById('paymentStatusMessage');
          if (statusMessage) {
            statusMessage.classList.add('alert-warning', 'show');
            statusMessage.classList.remove('d-none', 'alert-info');
            document.getElementById('paymentStatusText').innerHTML = 
              'Payment verification is taking longer than expected. Please check your <a href="/customer/orders.html">orders page</a>.';
          }
        }
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
        if (statusMessage) {
          statusMessage.classList.add('alert-danger', 'show');
          statusMessage.classList.remove('d-none', 'alert-info');
          document.getElementById('paymentStatusText').textContent = 
            'Error checking payment status. Retrying...';
        }
        // Stop polling after 5 minutes
        const { timestamp } = JSON.parse(pendingPayment);
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          clearInterval(pollInterval);
          sessionStorage.removeItem('pendingPayment');
          sessionStorage.removeItem('pendingOrder');
          window.location.href = '/customer/failed.html';
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
      window.location.href = '/customer/login.html';
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
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
      window.location.href = '/customer/profile.html';
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
        <a href="/customer/profile.html" class="btn btn-outline-primary btn-sm">
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
      window.location.href = '/customer/login.html';
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Failed to load cart: ${response.statusText}`);
      
      const data = await response.json();
      console.log('Raw cart data:', JSON.stringify(data, null, 2));
      
      // Map cart items using API-provided fields
      this.cartItems = (data.cartItems || []).map(item => {
        const price = parseFloat(item.price) || 0;
        console.log('Processing cart item:', { menuId: item.menuId, name: item.name, price, quantity: item.quantity });
        return {
          menuId: item.menuId,
          name: item.name || 'Unknown Item', // Use API-provided name
          price: price, // Use API-provided price
          quantity: Number(item.quantity) || 0,
          size: item.size || null,
          sizeId: item.sizeId || null
        };
      }).filter(item => {
        // Filter invalid items and log issues
        const isValid = item.menuId && item.name !== 'Unknown Item' && item.quantity > 0 && item.price > 0;
        if (!isValid) {
          console.warn('Invalid cart item filtered out:', item);
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
        this.initializeDatePicker();
      });
    } else {
      this.bindEvents();
      this.renderCustomerInfo();
      this.initializeDatePicker();
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
        <div class="card-header" style="background-color: #2c9045; color: white;">
          <h4 class="mb-0">Checkout</h4>
        </div>
        <div class="card-body">
          <!-- Payment Method Section -->
          <h5 class="mb-3"><i class="fas fa-credit-card"></i> Payment Method</h5>
${this.isCustomCakeCheckout && this.customCakeData.isDownpayment ? `
  <!-- For custom cake downpayment, force GCash -->
  <div class="alert alert-info mb-3">
    <i class="fas fa-info-circle"></i>
    <strong>Downpayment Policy:</strong> Custom cakes require 50% downpayment via GCash to confirm your order.
  </div>
  <div class="form-check mb-4">
    <input class="form-check-input" type="radio" name="paymentMethod" 
           id="gcash" value="gcash" checked disabled>
    <label class="form-check-label" for="gcash">
      <i class="fas fa-mobile-alt"></i> GCash (Required for 50% Downpayment)
    </label>
  </div>
` : `
  <!-- For final payment or regular orders, show both options -->
  <div class="form-check mb-2">
    <input class="form-check-input" type="radio" name="paymentMethod" 
           id="cash" value="cash" ${!this.isCustomCakeCheckout ? 'checked' : ''}>
    <label class="form-check-label" for="cash">
      <i class="fas fa-money-bill-wave"></i> Cash on Delivery/Pickup
    </label>
  </div>
  <div class="form-check mb-4">
    <input class="form-check-input" type="radio" name="paymentMethod" 
           id="gcash" value="gcash" ${this.isCustomCakeCheckout && !this.customCakeData.isDownpayment ? 'checked' : ''}>
    <label class="form-check-label" for="gcash">
      <i class="fas fa-mobile-alt"></i> GCash
    </label>
  </div>
`}

          <!-- Delivery Method Section -->
          <h5 class="mb-3"><i class="fas fa-shipping-fast"></i> Delivery Method</h5>
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="deliveryMethod" 
                   id="pickup" value="pickup" checked>
            <label class="form-check-label" for="pickup">
              <i class="fas fa-store"></i> Store Pickup
            </label>
          </div>
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="deliveryMethod" 
                   id="delivery" value="delivery">
            <label class="form-check-label" for="delivery">
              <i class="fas fa-truck"></i> Home Delivery
            </label>
          </div>
          <div class="mt-3 mb-4" id="datePickerContainer">
            <label for="pickupDate" class="form-label">Select Pickup/Delivery Date:</label>
            <input type="text" class="form-control" id="pickupDate" placeholder="Select a date" readonly>
          </div>

          <!-- Customer Information Section -->
          <h5 class="mb-3"><i class="fas fa-user"></i> Customer Information</h5>
          <div class="mb-4" id="customerInfoContainer">
            <p>Loading profile information...</p>
          </div>

          <!-- Order Summary Section -->
          <h5 class="mb-3"><i class="fas fa-list"></i> Order Summary</h5>
          <div id="cartSummary"></div>
          <hr>
          <div class="d-flex justify-content-between mb-4">
            <h5>Total:</h5>
            <h5 id="orderTotal">₱0.00</h5>
          </div>

          <!-- Payment Status and Place Order -->
          <div id="paymentStatusMessage" class="alert alert-info d-none mb-3">
            <i class="fas fa-info-circle"></i> <span id="paymentStatusText">Processing payment...</span>
          </div>
          <div class="text-center">
            <button type="button" class="btn btn-success btn-lg checkout-btn" onclick="checkoutManager.placeOrder()">
              <i class="fas fa-check"></i> Place Order
            </button>
          </div>
        </div>
      </div>
    `;
    this.handlePaymentMethodChange('gcash');
    this.handleDeliveryMethodChange('pickup');
}
  /**
   * Initializes the Flatpickr datepicker for pickup/delivery date selection.
   */
  initializeDatePicker() {
    const dateInput = document.getElementById('pickupDate');
    if (dateInput) {
      if (typeof flatpickr === 'undefined') {
        console.error('Flatpickr is not loaded');
        return;
      }
      flatpickr(dateInput, {
        minDate: "today",
        maxDate: new Date().fp_incr(7),
        dateFormat: "Y-m-d",
        onChange: (selectedDates, dateStr) => {
          this.checkoutData.pickupDate = dateStr;
          console.log('Selected date:', dateStr);
        }
      });
    }
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
    
    // Show downpayment information for custom cakes
    if (item.isCustomCake && item.isDownpayment) {
      // FIX: Properly handle totalPrice which might be a string or number
      const totalPrice = typeof item.totalPrice === 'number' ? item.totalPrice : 
                        parseFloat(item.totalPrice) || this.customCakeOrder?.price || 0;
      
      return `
        <div class="mb-2">
          <div class="d-flex justify-content-between">
            <span>${name}${item.size ? ` (${item.size})` : ''} x${quantity}</span>
            <span>₱${(price * quantity).toFixed(2)}</span>
          </div>
          <div class="downpayment-info">
            <small class="text-muted">
              <i class="fas fa-info-circle"></i> 
              50% Downpayment (Total: ₱${totalPrice.toFixed(2)})
            </small>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="d-flex justify-content-between mb-2">
          <span>${name}${item.size ? ` (${item.size})` : ''} x${quantity}</span>
          <span>₱${(price * quantity).toFixed(2)}</span>
        </div>
      `;
    }
  }).join('');

  const total = this.cartItems.reduce((sum, item) => {
  const price = Number(item.price) || 0;
  const quantity = Number(item.quantity) || 0;
  return sum + price * quantity;
}, 0);

  orderTotal.textContent = `₱${total.toFixed(2)}`;

  // Add downpayment note for custom cakes
  if (this.isCustomCakeCheckout && this.customCakeData.isDownpayment) {
    // FIX: Use the actual total price from the order
    const totalPrice = this.customCakeOrder?.price ? parseFloat(this.customCakeOrder.price) : 
                      this.customCakeData.totalPrice ? parseFloat(this.customCakeData.totalPrice) : 0;
    
    cartSummary.innerHTML += `
      <div class="alert alert-info mt-3 mb-0">
        <small>
          <i class="fas fa-exclamation-circle"></i>
          <strong>Downpayment Notice:</strong> You are paying a 50% downpayment of ₱${total.toFixed(2)}. 
          The remaining balance of ₱${(totalPrice - total).toFixed(2)} will be paid upon pickup/delivery.
        </small>
      </div>
    `;
  }
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
    const dateInput = document.getElementById('pickupDate');
    if (dateInput) {
      dateInput.disabled = !method; // Enable datepicker only if a method is selected
      if (!method) this.checkoutData.pickupDate = null; // Clear date if no method
    }
  }

  /**
   * Handles order placement and payment processing.
   */
  // checkout.js - UPDATED PLACE ORDER METHOD
// checkout.js - COMPLETELY FIXED placeOrder METHOD
async placeOrder() {
  const checkoutBtn = document.querySelector('.checkout-btn');
  const statusMessage = document.getElementById('paymentStatusMessage');
  
  try {
    // Common validation
    const profile = this.customerProfile;
    const requiredFields = ['name', 'email', 'phone'];
    const missingFields = requiredFields.filter(field => !profile[field]);
    
    if (missingFields.length > 0) {
      alert(`Please complete your profile (${missingFields.join(', ')}) before placing an order.`);
      window.location.href = '/customer/profile.html';
      return;
    }

    if (this.checkoutData.deliveryMethod === 'delivery' && !profile.address) {
      alert('Please provide a delivery address in your profile for home delivery.');
      window.location.href = '/customer/profile.html';
      return;
    }

    if (!this.checkoutData.pickupDate) {
      alert('Please select a pickup or delivery date.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('Session expired. Please login again.');
      window.location.href = '/customer/login.html';
      return;
    }

    // Disable button and show status
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    if (statusMessage) {
      statusMessage.classList.remove('d-none');
      statusMessage.classList.add('show', 'alert-info');
      const paymentType = this.customCakeData?.isDownpayment ? 'downpayment' : 'payment';
      document.getElementById('paymentStatusText').textContent = `Processing your ${paymentType}...`;
    }

    // FIXED: Build proper payment payload based on order type
    if (this.isCustomCakeCheckout) {
      await this.processCustomCakePayment(token, profile, checkoutBtn, statusMessage);
    } else {
      await this.processRegularOrderPayment(token, profile, checkoutBtn, statusMessage);
    }

  } catch (error) {
    console.error('Order placement failed:', error);
    alert(`Order failed: ${error.message}. Please try again.`);
    this.resetCheckoutButton(checkoutBtn);
    this.hideStatusMessage(statusMessage);
  }
}

async processCustomCakePayment(token, profile, checkoutBtn, statusMessage) {
  const isDownpayment = this.customCakeData.isDownpayment;
  const amount = this.customCakeData.amount; // Already calculated as downpayment or full

  if (isDownpayment && this.checkoutData.paymentMethod !== 'gcash') {
    alert('Custom cakes require 50% downpayment via GCash. Please use GCash for the downpayment.');
    this.resetCheckoutButton(checkoutBtn);
    this.hideStatusMessage(statusMessage);
    return;
  }
  
  // Validate minimum for GCash
   if (this.checkoutData.paymentMethod === 'gcash' && amount * 100 < 2000) {
    alert('GCash payments require a minimum amount of ₱20.00.');
    this.resetCheckoutButton(checkoutBtn);
    this.hideStatusMessage(statusMessage);
    return;
  }

  // Build payment payload
  const paymentPayload = {
    customCakeId: this.customCakeData.customCakeId,
    isImageOrder: this.customCakeData.isImageOrder,
    amount: amount * 100, // Convert to cents
    isDownpayment: isDownpayment,
    deliveryDate: this.checkoutData.pickupDate,
    deliveryMethod: this.checkoutData.deliveryMethod,
    customerInfo: {
      fullName: profile.name,
      email: profile.email,
      phone: profile.phone,
      deliveryAddress: this.checkoutData.deliveryMethod === 'delivery' ? profile.address : null
    },
    description: `${this.customCakeData.isImageOrder ? 'Image-based' : '3D'} Custom Cake ${isDownpayment ? 'Downpayment (50%)' : 'Full Payment'}`,
    redirect: {
      success: `${window.location.origin}/customer/success.html`,
      failed: `${window.location.origin}/customer/failed.html`
    }
  };

  // Store pending data
  sessionStorage.setItem('pendingCustomCakeOrder', JSON.stringify({
    ...paymentPayload,
    totalAmount: amount,
    paymentMethod: this.checkoutData.paymentMethod
  }));

  console.log('Custom cake payment payload:', paymentPayload);

  if (this.checkoutData.paymentMethod === 'gcash') {
    // GCash payment flow
    const paymentResponse = await fetch(`${window.API_BASE_URL}/api/payment/create-gcash-source`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    
    if (!paymentResponse.ok || !paymentData.success) {
      throw new Error(paymentData.error || 'Payment failed');
    }

    // Store pending payment
    sessionStorage.setItem('pendingPayment', JSON.stringify({
      paymentId: paymentData.paymentId,
      timestamp: Date.now(),
      paymentMethod: 'gcash',
      isCustomCake: true,
      isDownpayment: isDownpayment
    }));

    // Open payment window
    const paymentWindow = window.open(
      paymentData.checkoutUrl,
      'GCashPayment',
      'width=500,height=800,scrollbars=yes'
    );

    if (paymentWindow) {
      paymentWindow.focus();
      if (statusMessage) {
        const paymentType = isDownpayment ? 'downpayment' : 'payment';
        document.getElementById('paymentStatusText').textContent = 
          `Please complete the GCash ${paymentType} in the popup window...`;
      }
      this.startPaymentPolling();
    } else {
      throw new Error('Popup blocked! Please allow popups for this site.');
    }

  } else {
    // Cash payment flow
    const cashPayload = {
      customCakeId: this.customCakeData.customCakeId,
      isImageOrder: this.customCakeData.isImageOrder,
      pickupDate: this.checkoutData.pickupDate,
      customerInfo: paymentPayload.customerInfo,
      totalAmount: amount,
      isDownpayment: isDownpayment
    };

    console.log('Cash payment payload:', cashPayload);

    const response = await fetch(`${window.API_BASE_URL}/api/custom-cake/process-cash-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cashPayload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Cash payment processing failed');
    }

    const result = await response.json();
    
    // Redirect to success page
    const downpaymentParam = isDownpayment ? '&isDownpayment=true' : '';
    window.location.href = `/customer/success.html?orderId=${this.customCakeData.customCakeId}&isCustomCake=true${downpaymentParam}`;
  }
}

async processRegularOrderPayment(token, profile, checkoutBtn, statusMessage) {
  // Calculate total
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

  if (totalAmount <= 0) {
    throw new Error('Total amount must be greater than zero');
  }

  // Store pending order
  sessionStorage.setItem('pendingOrder', JSON.stringify({
    items: orderItems,
    totalAmount: totalAmount,
    paymentMethod: this.checkoutData.paymentMethod,
    deliveryMethod: this.checkoutData.deliveryMethod,
    pickupDate: this.checkoutData.pickupDate,
    customerInfo: {
      fullName: profile.name,
      email: profile.email,
      phone: profile.phone,
      deliveryAddress: this.checkoutData.deliveryMethod === 'delivery' ? profile.address : null
    }
  }));

  if (this.checkoutData.paymentMethod === 'gcash') {
    // Validate minimum
    if (totalAmount * 100 < 2000) {
      alert('GCash payments require a minimum amount of ₱20.00.');
      this.resetCheckoutButton(checkoutBtn);
      this.hideStatusMessage(statusMessage);
      return;
    }

    const paymentPayload = {
      amount: totalAmount * 100,
      items: orderItems,
      deliveryDate: this.checkoutData.pickupDate,
      deliveryMethod: this.checkoutData.deliveryMethod,
      customerInfo: {
        fullName: profile.name,
        email: profile.email,
        phone: profile.phone,
        deliveryAddress: this.checkoutData.deliveryMethod === 'delivery' ? profile.address : null
      },
      description: 'Regular Order',
      redirect: {
        success: `${window.location.origin}/customer/success.html`,
        failed: `${window.location.origin}/customer/failed.html`
      }
    };

    const paymentResponse = await fetch(`${window.API_BASE_URL}/api/payment/create-gcash-source`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentData = await paymentResponse.json();
    
    if (!paymentResponse.ok || !paymentData.success) {
      throw new Error(paymentData.error || 'Payment failed');
    }

    sessionStorage.setItem('pendingPayment', JSON.stringify({
      paymentId: paymentData.paymentId,
      timestamp: Date.now(),
      paymentMethod: 'gcash',
      isCustomCake: false
    }));

    const paymentWindow = window.open(
      paymentData.checkoutUrl,
      'GCashPayment',
      'width=500,height=800,scrollbars=yes'
    );

    if (paymentWindow) {
      paymentWindow.focus();
      this.startPaymentPolling();
    } else {
      throw new Error('Popup blocked! Please allow popups for this site.');
    }

  } else {
    // Cash payment
    const orderData = JSON.parse(sessionStorage.getItem('pendingOrder'));
    
    const response = await fetch(`${window.API_BASE_URL}/api/orders/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Order creation failed');
    }

    const result = await response.json();
    window.location.href = `/customer/success.html?orderId=${result.orderId}`;
  }
}

// Helper methods
resetCheckoutButton(checkoutBtn) {
  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
  }
}

hideStatusMessage(statusMessage) {
  if (statusMessage) {
    statusMessage.classList.add('d-none');
    statusMessage.classList.remove('show');
  }
}

// Add helper method to reset checkout button
resetCheckoutButton(checkoutBtn) {
  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
  }
}

async placeCustomCakeOrder() {
  const profile = this.customerProfile;
  const requiredFields = ['name', 'email', 'phone'];
  const missingFields = requiredFields.filter(field => !profile[field]);
  
  if (missingFields.length > 0) {
    alert(`Please complete your profile (${missingFields.join(', ')}) before placing an order.`);
    window.location.href = '/customer/profile.html';
    return;
  }

  if (this.checkoutData.deliveryMethod === 'delivery' && !profile.address) {
    alert('Please provide a delivery address in your profile for home delivery.');
    window.location.href = '/customer/profile.html';
    return;
  }

  if (!this.checkoutData.pickupDate) {
    alert('Please select a pickup or delivery date.');
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    alert('Session expired. Please login again.');
    window.location.href = '/customer/login.html';
    return;
  }

  try {
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    const statusMessage = document.getElementById('paymentStatusMessage');
    if (statusMessage) {
      statusMessage.classList.remove('d-none');
      statusMessage.classList.add('show');
    }

    // FIXED: Use consistent naming - only use deliveryDate
    const orderData = {
      customCakeId: this.customCakeData.customCakeId,
      isImageOrder: this.customCakeData.isImageOrder,
      totalAmount: this.customCakeData.amount,
      paymentMethod: this.checkoutData.paymentMethod,
      deliveryMethod: this.checkoutData.deliveryMethod,
      deliveryDate: this.checkoutData.pickupDate, // ← USE ONLY deliveryDate
      customerInfo: {
        fullName: profile.name,
        email: profile.email,
        phone: profile.phone,
        deliveryAddress: this.checkoutData.deliveryMethod === 'delivery' ? profile.address : null
      }
    };

    sessionStorage.setItem('pendingCustomCakeOrder', JSON.stringify(orderData));

    if (this.checkoutData.paymentMethod === 'gcash') {
      if (this.customCakeData.amount * 100 < 2000) {
        alert('GCash payments require a minimum amount of ₱20.00.');
        if (checkoutBtn) {
          checkoutBtn.disabled = false;
          checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
        }
        if (statusMessage) {
          statusMessage.classList.add('d-none');
          statusMessage.classList.remove('show');
        }
        return;
      }

      console.log('Initiating GCash payment for custom cake with deliveryDate:', this.checkoutData.pickupDate);
      const successUrl = `${window.location.origin}/customer/success.html`;
      const failedUrl = `${window.location.origin}/customer/failed.html`;

      // FIXED: Ensure deliveryDate is properly sent
      const paymentPayload = {
        customCakeId: this.customCakeData.customCakeId,
        isImageOrder: this.customCakeData.isImageOrder,
        amount: this.customCakeData.amount * 100,
        description: this.customCakeData.isImageOrder ? 'Custom Image Cake Order' : '3D Custom Cake Order',
        deliveryDate: this.checkoutData.pickupDate, // ← CONSISTENT NAME
        redirect: {
          success: successUrl,
          failed: failedUrl
        }
      };

      console.log('GCash Payment Payload:', paymentPayload);

      const paymentResponse = await fetch(`${window.API_BASE_URL}/api/payment/create-custom-cake-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentPayload)
      });

      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) {
        throw new Error(paymentData.error || 'Payment processing failed');
      }

      sessionStorage.setItem('pendingPayment', JSON.stringify({
        paymentId: paymentData.paymentId,
        timestamp: Date.now(),
        paymentMethod: 'gcash',
        isCustomCake: true
      }));

      const paymentWindow = window.open(
        paymentData.checkoutUrl,
        'GCashPayment',
        'width=500,height=800,scrollbars=yes'
      );

      this.startPaymentPolling();

      if (paymentWindow) {
        paymentWindow.focus();
      }

      if (statusMessage) {
        document.getElementById('paymentStatusText').textContent = 
          'Please complete the GCash payment in the popup window...';
      }

    } else if (this.checkoutData.paymentMethod === 'cash') {
      if (statusMessage) {
        statusMessage.classList.remove('d-none');
        statusMessage.classList.add('show');
        document.getElementById('paymentStatusText').textContent = 
          'Processing your custom cake order...';
      }
      
      const response = await fetch(`${window.API_BASE_URL}/api/payment/process-cash-custom-cake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customCakeId: this.customCakeData.customCakeId,
          isImageOrder: this.customCakeData.isImageOrder,
          pickupDate: this.checkoutData.pickupDate
        })
      });
      
      if (!response.ok) throw new Error('Custom cake order creation failed');
      const result = await response.json();
      window.location.href = `/customer/success.html?orderId=${this.customCakeData.customCakeId}&isCustomCake=true`;
    }

  } catch (error) {
    console.error('Custom cake order placement failed:', error);
    alert(`Order failed: ${error.message}. Please try again.`);
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
    }
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
   * 3. Creates or updates order if payment succeeded
   * 4. Redirects to appropriate page (success/failed)
   * 5. Cleans up session storage
   */
async handleReturnFromPaymongo() {
  const pendingPayment = sessionStorage.getItem('pendingPayment');
  const pendingOrder = sessionStorage.getItem('pendingOrder');
  const pendingCustomCakeOrder = sessionStorage.getItem('pendingCustomCakeOrder');
  
  if (!pendingPayment || (!pendingOrder && !pendingCustomCakeOrder)) {
    console.log('No pending payment found');
    return;
  }

  try {
    const paymentData = JSON.parse(pendingPayment);
    const { paymentId, isCustomCake, isDownpayment } = paymentData;
    const token = localStorage.getItem('token');

    console.log('Verifying payment:', { paymentId, isCustomCake, isDownpayment });

    // Verify payment status with retry logic
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        response = await fetch(`${window.API_BASE_URL}/api/payment/verify-payment/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) break;
        
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    if (!response.ok) {
      throw new Error('Payment verification failed after retries');
    }

    const result = await response.json();
    console.log('Payment verification result:', result);
    
    // Handle successful payment
    if (result.success && result.isPaid) {
      
      // Handle custom cake orders - UPDATED for downpayment
      if (isCustomCake && pendingCustomCakeOrder) {
        const customCakeData = JSON.parse(pendingCustomCakeOrder);
        
        console.log('Custom cake payment verified:', { 
          isDownpayment, 
          deliveryDate: customCakeData.deliveryDate 
        });
        
        // Use different endpoint for downpayment vs full payment
        const verifyEndpoint = isDownpayment ?
          `${window.API_BASE_URL}/api/payment/verify-custom-cake-downpayment` :
          `${window.API_BASE_URL}/api/payment/verify-custom-cake-payment`;
        
        const updateResponse = await fetch(verifyEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentId,
            customCakeData: {
              ...customCakeData,
              totalAmount: customCakeData.amount / 100, // Convert back from cents
              downpaymentAmount: isDownpayment ? (customCakeData.amount / 100) : null
            }
          })
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(`Custom cake update failed: ${JSON.stringify(errorData)}`);
        }

        const updateResult = await updateResponse.json();
        console.log('Custom cake updated:', updateResult);
        
        // Clear session storage
        sessionStorage.removeItem('pendingPayment');
        sessionStorage.removeItem('pendingCustomCakeOrder');
        
        // Redirect to success page
        const downpaymentParam = isDownpayment ? `&isDownpayment=true` : '';
        window.location.href = `/customer/success.html?orderId=${customCakeData.customCakeId}&isCustomCake=true${downpaymentParam}`;
        return;
      }
      
      // Handle regular orders (unchanged)
      if (pendingOrder) {
        const orderData = JSON.parse(pendingOrder);
        
        console.log('Regular order payment verified, creating/updating order...');
        
        // Create or update order
        const updateResponse = await fetch(`${window.API_BASE_URL}/api/orders/verify-gcash-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            paymentId,
            orderData
          })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Order creation failed: ${errorText}`);
        }

        const { order } = await updateResponse.json();
        
        console.log('Order created/updated:', order.orderId);
        
        // Clear session storage
        sessionStorage.removeItem('pendingPayment');
        sessionStorage.removeItem('pendingOrder');
        
        // Redirect to success page
        window.location.href = `/customer/success.html?orderId=${order.orderId}`;
      }
      
    } else if (result.status === 'failed') {
      // Payment failed
      console.warn('Payment failed:', result);
      sessionStorage.removeItem('pendingPayment');
      sessionStorage.removeItem('pendingOrder');
      sessionStorage.removeItem('pendingCustomCakeOrder');
      window.location.href = '/customer/failed.html';
      
    } else {
      // Payment still pending
      console.log('Payment still pending, will retry...');
    }

   } catch (error) {
    console.error('Payment verification error:', error);
    
    // Show error message to user
    const statusMessage = document.getElementById('paymentStatusMessage');
    if (statusMessage) {
      statusMessage.classList.remove('alert-info', 'd-none');
      statusMessage.classList.add('alert-danger', 'show');
      document.getElementById('paymentStatusText').textContent = 
        'Payment verification failed. Please check your orders page or contact support.';
    }
  }
}

  async cancelOrder(orderId) {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('No token found, redirecting to login');
      window.location.href = '/customer/login.html';
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/orders/cancel/${orderId}`, {
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
      window.location.href = '/customer/cart.html';
    } catch (error) {
      console.error('Error canceling order:', error);
      alert('Error canceling order. Please try again.');
    }
  }
}

// Instantiate the CheckoutManager
const checkoutManager = new CheckoutManager();