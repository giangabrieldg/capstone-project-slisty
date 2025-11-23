class CheckoutManager {
  constructor() {
    // Initialize state
    this.cartItems = [];
    this.customerProfile = {};
    this.checkoutData = {
      paymentMethod: "gcash",
      deliveryMethod: "pickup",
      customerInfo: {},
      orderDetails: {},
      pickupDate: null,
    };
    this.init();
  }

  //Initializes the checkout process, sets up event listeners, and checks for payment return.

  init() {
    this.isCustomCakeCheckout = this.checkForCustomCake();

    if (this.isCustomCakeCheckout) {
      this.loadCustomCakeOrder();
    } else {
      this.loadCartItems();
    }

    this.loadCustomerProfile();
    this.setupEventListeners();
    this.initializeDatePicker();
    this.loadTermsAndConditions();

    const isPageRefresh =
      performance.navigation.type === 1 ||
      performance.getEntriesByType("navigation")[0]?.type === "reload";

    // Clean up stale pending order/payment data
    const pendingPayment = sessionStorage.getItem("pendingPayment");

    if (pendingPayment) {
      const { timestamp, paymentMethod } = JSON.parse(pendingPayment);
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30 minutes
      const timeSincePendingPayment = now - timestamp;

      // If user refreshed the page, clear stale payment data
      if (isPageRefresh) {
        console.warn("Page refresh detected - clearing stale pending payment");
        sessionStorage.removeItem("pendingPayment");
        sessionStorage.removeItem("pendingOrder");
        sessionStorage.removeItem("pendingCustomCakeOrder");
        return; // Don't continue with polling
      }

      // If payment is older than timeout, clear it
      if (timeSincePendingPayment > timeout) {
        sessionStorage.removeItem("pendingPayment");
        sessionStorage.removeItem("pendingOrder");
        sessionStorage.removeItem("pendingCustomCakeOrder");
      }
      // If not a refresh and payment is still valid, check status
      else if (window.location.pathname.includes("checkout.html")) {
        this.handleReturnFromPaymongo(); // Check immediately
        this.startPaymentPolling();
      }
    }

    // Trigger payment verification if on success.html
    if (window.location.pathname.includes("success.html")) {
      this.handleReturnFromPaymongo();
    }

    // Add beforeunload listener to warn about pending payments
    window.addEventListener("beforeunload", (event) => {
      if (
        sessionStorage.getItem("pendingPayment") &&
        this.checkoutData.paymentMethod === "gcash"
      ) {
        event.preventDefault();
        event.returnValue =
          "You have a pending payment. Navigating away may cancel your order. Are you sure?";
      }
    });
  }

  //Checks if the checkout is for a custom cake order.
  //@returns {boolean} True if custom cake checkout, false otherwise.

  checkForCustomCake() {
    const urlParams = new URLSearchParams(window.location.search);
    this.customCakeData = {
      customCakeId: urlParams.get("customCakeId"),
      isImageOrder: urlParams.get("isImageOrder") === "true",
      amount: parseFloat(urlParams.get("amount")),
    };

    return !!this.customCakeData.customCakeId;
  }

  //Loads custom cake order details from the server.

  async loadCustomCakeOrder() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    try {
      // Use correct endpoint based on order type
      const endpoint = this.customCakeData.isImageOrder
        ? `${window.API_BASE_URL}/api/custom-cake/image-orders/${this.customCakeData.customCakeId}`
        : `${window.API_BASE_URL}/api/custom-cake/${this.customCakeData.customCakeId}`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load custom cake order");

      const data = await response.json();
      this.customCakeOrder = data.order || data;

      // Add proper null checking
      if (!this.customCakeOrder) {
        console.error("Custom cake order is null or undefined");
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Failed to load custom cake order. Please try again.",
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/custom-orders.html";
        return;
      }

      // NEW: Pre-fill delivery date for image-based orders
      if (
        this.customCakeData.isImageOrder &&
        this.customCakeOrder.deliveryDate
      ) {
        this.prefillDeliveryDate(this.customCakeOrder.deliveryDate);
      }

      // Check if price is properly set
      if (!this.customCakeOrder.price || this.customCakeOrder.price <= 0) {
        console.error(
          "Order price not set or invalid:",
          this.customCakeOrder.price
        );
        await wal.fire({
          icon: "error",
          title: "Oops...",
          text: "This order does not have a valid price set.",
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/custom-orders.html";
        return;
      }

      // Determine payment type based on order type and current status
      let isDownpayment = false;
      let paymentAmount = this.customCakeOrder.price;

      // For image-based orders, accept both "Feasible" and "Ready for Downpayment"
      const validDownpaymentStatuses = this.customCakeData.isImageOrder
        ? ["Feasible", "Ready for Downpayment"]
        : ["Pending Payment", "Ready for Downpayment"]; // Updated for 3D cakes

      if (validDownpaymentStatuses.includes(this.customCakeOrder.status)) {
        // First payment - downpayment flow
        isDownpayment = true;
        // Use downpayment_amount if set, otherwise calculate 50%
        paymentAmount =
          this.customCakeOrder.downpayment_amount ||
          this.customCakeOrder.price * 0.5;
      } else if (this.customCakeOrder.status === "Downpayment Paid") {
        // Second payment - remaining balance
        isDownpayment = false;
        paymentAmount =
          this.customCakeOrder.remaining_balance ||
          this.customCakeOrder.price * 0.5;
      } else {
        // Invalid status for checkout
        console.error(
          "Invalid order status for checkout:",
          this.customCakeOrder.status
        );
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: `This order is not ready for payment. Current status: ${this.customCakeOrder.status}`,
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/custom-orders.html";
        return;
      }

      // Update custom cake data with payment info
      this.customCakeData.amount = paymentAmount;
      this.customCakeData.isDownpayment = isDownpayment;
      this.customCakeData.totalPrice = this.customCakeOrder.price;
      this.customCakeData.downpaymentAmount =
        this.customCakeOrder.downpayment_amount ||
        this.customCakeOrder.price * 0.5;
      this.customCakeData.remainingBalance =
        this.customCakeOrder.remaining_balance ||
        this.customCakeOrder.price * 0.5;

      // Create mock cart item for display - ensure data types
      const paymentLabel = isDownpayment
        ? "50% Downpayment"
        : "Final Payment (50%)";
      const orderType = this.customCakeData.isImageOrder
        ? "Custom Image Cake"
        : "3D Custom Cake";

      // Ensure all prices are numbers
      const totalPrice = parseFloat(this.customCakeOrder.price) || 0;
      const downpaymentAmount =
        parseFloat(this.customCakeData.downpaymentAmount) || totalPrice * 0.5;
      const remainingBalance =
        parseFloat(this.customCakeData.remainingBalance) || totalPrice * 0.5;

      this.cartItems = [
        {
          menuId: null,
          name: `${orderType} - ${paymentLabel}`,
          price: paymentAmount,
          quantity: 1,
          size: this.customCakeOrder.size || "Custom",
          isCustomCake: true,
          customCakeId: this.customCakeData.customCakeId,
          isImageOrder: this.customCakeData.isImageOrder,
          isDownpayment: isDownpayment,
          totalPrice: totalPrice,
          downpaymentAmount: downpaymentAmount,
          remainingBalance: remainingBalance,
        },
      ];

      // Update payment methods for custom cake downpayment
      this.updatePaymentMethodsForCustomCake(isDownpayment);
      this.renderCartSummary();
    } catch (error) {
      console.error("Error loading custom cake order:", {
        error: error.message,
        customCakeId: this.customCakeData.customCakeId,
        isImageOrder: this.customCakeData.isImageOrder,
        stack: error.stack,
      });

      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error loading custom cake order. Please try again.",
        confirmButtonColor: "#2c9045",
      });
      return;
    }
  }

  async loadTermsAndConditions() {
    try {
      const termsContent = document.getElementById("termsContent");
      if (termsContent) {
        termsContent.innerHTML = `
        <div class="terms-content">
          <h6 class="text-success mb-3"><i class="fas fa-gavel"></i> Orders & Custom Cakes</h6>
          <ul class="mb-4">
            <li>We accept orders for standard menu items and custom cakes.</li>
            <li>Custom cake orders must be placed at least 1 week before the event.</li>
            <li>A 50% down payment through GCash is required for all custom cake orders.</li>
            <li>Exact replication of reference designs is not guaranteed.</li>
          </ul>

          <h6 class="text-success mb-3"><i class="fas fa-credit-card"></i> Payments</h6>
          <ul class="mb-4">
            <li>Payments can be made through GCash via PayMongo or Cash.</li>
            <li>Orders will be processed only after payment is verified.</li>
          </ul>

          <h6 class="text-success mb-3"><i class="fas fa-truck"></i> Delivery & Pick-Up</h6>
          <ul class="mb-4">
            <li>Pick-up is encouraged for cake/food safety.</li>
            <li>Slice N Grind uses Lalamove for deliveries.</li>
            <li>Delivery fees are charged to the customer.</li>
          </ul>
          
          <h6 class="text-success mb-3"><i class="fas fa-user-check"></i> Customer Responsibilities</h6>
          <ul class="mb-4">
            <li>Provide accurate information during ordering.</li>
            <li>Respond to verification messages promptly.</li>
            <li>Inspect the order upon pick-up or delivery.</li>
            <li>Handle and store cakes/food properly.</li>
          </ul>

          <h6 class="text-success mb-3"><i class="fas fa-shield-alt"></i> Privacy & Liability</h6>
          <ul class="mb-4">
            <li>Personal information is used only for order processing and will only be shared with PayMongo and Lalamove as needed.</li>
          </ul>

          <div class="alert alert-info mt-4">
            <small>
              <i class="fas fa-info-circle"></i>
              By placing an order, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </small>
          </div>
        </div>
      `;
      }
    } catch (error) {
      console.error("Error loading terms and conditions:", error);
      // Fallback content in case of error
      const termsContent = document.getElementById("termsContent");
      if (termsContent) {
        termsContent.innerHTML = `
        <div class="alert alert-warning">
          <p>By placing an order with Slice N Grind, you agree to our standard terms and conditions including downpayment requirements, delivery policies, and cancellation terms.</p>
          <p>Please contact us for complete terms and conditions.</p>
        </div>
      `;
      }
    }
  }

  // Update the payment methods display to only show GCash for custom cakes
  updatePaymentMethodsForCustomCake(isDownpayment) {
    const downpaymentNotice = document.getElementById("downpaymentNotice");
    const paymentMethodsContainer = document.getElementById(
      "paymentMethodsContainer"
    );

    if (this.isCustomCakeCheckout) {
      // For custom cakes, only show GCash
      downpaymentNotice.classList.remove("d-none");
      paymentMethodsContainer.innerHTML = `
      <div class="form-check mb-4">
        <input class="form-check-input" type="radio" name="paymentMethod" 
               id="gcash" value="gcash" checked disabled>
        <label class="form-check-label" for="gcash">
          <i class="fas fa-mobile-alt"></i> GCash ${
            isDownpayment
              ? "(Required for 50% Downpayment)"
              : "(Required for Final Payment)"
          }
        </label>
      </div>
    `;
      this.checkoutData.paymentMethod = "gcash";
    } else {
      // For regular orders, you can keep both options if needed
      downpaymentNotice.classList.add("d-none");
      // Your existing regular order payment methods
    }

    this.bindEvents();
  }

  //Starts polling to check payment status and handle return flow.

  startPaymentPolling() {
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes (60 * 5 seconds)

    const pollInterval = setInterval(async () => {
      pollCount++;

      const pendingPayment = sessionStorage.getItem("pendingPayment");
      if (!pendingPayment || pollCount >= maxPolls) {
        clearInterval(pollInterval);

        if (pollCount >= maxPolls) {
          console.warn("Polling timeout reached");
          const statusMessage = document.getElementById("paymentStatusMessage");
          if (statusMessage) {
            statusMessage.classList.add("alert-warning", "show");
            statusMessage.classList.remove("d-none", "alert-info");
            document.getElementById("paymentStatusText").innerHTML =
              'Payment verification is taking longer than expected. Please check your <a href="/customer/orders.html">orders page</a>.';
          }
        }
        return;
      }

      const statusMessage = document.getElementById("paymentStatusMessage");
      if (statusMessage) {
        document.getElementById("paymentStatusText").textContent =
          "Checking payment status...";
      }

      try {
        await this.handleReturnFromPaymongo();
        if (!sessionStorage.getItem("pendingPayment")) {
          clearInterval(pollInterval);
          if (statusMessage) {
            statusMessage.classList.add("d-none");
            statusMessage.classList.remove("show");
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (statusMessage) {
          statusMessage.classList.add("alert-danger", "show");
          statusMessage.classList.remove("d-none", "alert-info");
          document.getElementById("paymentStatusText").textContent =
            "Error checking payment status. Retrying...";
        }
        // Stop polling after 5 minutes
        const { timestamp } = JSON.parse(pendingPayment);
        if (Date.now() - timestamp > 5 * 60 * 1000) {
          clearInterval(pollInterval);
          sessionStorage.removeItem("pendingPayment");
          sessionStorage.removeItem("pendingOrder");
          window.location.href = "/customer/failed.html";
        }
      }
    }, 5000); // Poll every 5 seconds
  }

  //Loads customer profile from the server.

  async loadCustomerProfile() {
    const token = sessionStorage.getItem("token");
    if (!token) {
      console.warn("No token found, redirecting to login");
      window.location.href = "/customer/login.html";
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to load profile");
      const data = await response.json();
      this.customerProfile = data || {};
      this.renderCustomerInfo();
    } catch (error) {
      console.error("Error loading customer profile:", error);
      await Swal.fire({
        icon: "warning",
        title: "Oops...",
        text: "Please update your profile and try again.",
        confirmButtonColor: "#2c9045",
      });
      window.location.href = "/customer/profile.html";
    }
  }

  //Renders customer profile information in the checkout form.

  renderCustomerInfo() {
    const customerInfoContainer = document.getElementById(
      "customerInfoContainer"
    );
    if (!customerInfoContainer || !this.customerProfile) return;

    const profile = this.customerProfile;
    customerInfoContainer.innerHTML = `
      <div class="mb-3">
        <strong>Full Name:</strong> <span class="profile-data">${
          profile.name || "Not set"
        }</span>
      </div>
      <div class="mb-3">
        <strong>Email Address:</strong> <span class="profile-data">${
          profile.email || "Not set"
        }</span>
      </div>
      <div class="mb-3">
        <strong>Phone Number:</strong> <span class="profile-data">${
          profile.phone || "Not set"
        }</span>
      </div>
      <div class="mb-3">
        <strong>Delivery Address:</strong> <span class="profile-data">${
          profile.address || "Not set"
        }</span>
      </div>
      <div class="text-center">
        <a href="/customer/profile.html" class="btn btn-outline-primary btn-sm">
          <i class="fas fa-edit"></i> Update Profile
        </a>
      </div>
    `;
    this.addProfileDataIndicators();
  }

  //Styles profile data fields for better visibility.

  addProfileDataIndicators() {
    const profileDataFields = document.querySelectorAll(".profile-data");
    profileDataFields.forEach((field) => {
      field.style.backgroundColor = "#f8f9fa";
      field.style.padding = "2px 5px";
      field.style.borderRadius = "3px";
    });
  }

  //Loads cart items from the server and validates them.

  async loadCartItems() {
    const token = sessionStorage.getItem("token");
    if (!token) {
      console.warn("No token found, redirecting to login");
      window.location.href = "/customer/login.html";
      return;
    }

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error(`Failed to load cart: ${response.statusText}`);

      const data = await response.json();

      // Map cart items using API-provided fields
      this.cartItems = (data.cartItems || [])
        .map((item) => {
          const price = parseFloat(item.price) || 0;
          return {
            menuId: item.menuId,
            name: item.name || "Unknown Item",
            price: price,
            quantity: Number(item.quantity) || 0,
            size: item.size || null,
            sizeId: item.sizeId || null,
          };
        })
        .filter((item) => {
          // Filter invalid items and log issues
          const isValid =
            item.menuId &&
            item.name !== "Unknown Item" &&
            item.quantity > 0 &&
            item.price > 0;
          if (!isValid) {
            console.warn("Invalid cart item filtered out:", item);
          }
          return isValid;
        });

      this.renderCartSummary();
    } catch (error) {
      console.error("Error loading cart:", error);
      await Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error loading cart items. Please try again.",
        confirmButtonColor: "#2c9045",
      });
      this.renderCartSummary();
    }
  }

  //Sets up event listeners for payment and delivery method changes.

  setupEventListeners() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
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

  //Binds events to payment and delivery method radio buttons.

  bindEvents() {
    const paymentMethods = document.querySelectorAll(
      'input[name="paymentMethod"]'
    );
    paymentMethods.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.handlePaymentMethodChange(e.target.value);
      });
    });

    const deliveryMethods = document.querySelectorAll(
      'input[name="deliveryMethod"]'
    );
    deliveryMethods.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.handleDeliveryMethodChange(e.target.value);
      });
    });

    // Set initial state based on checked radio buttons
    const initialPaymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    );
    if (initialPaymentMethod) {
      this.checkoutData.paymentMethod = initialPaymentMethod.value;
    }

    const initialDeliveryMethod = document.querySelector(
      'input[name="deliveryMethod"]:checked'
    );
    if (initialDeliveryMethod) {
      this.checkoutData.deliveryMethod = initialDeliveryMethod.value;
    }
  }

  //Initializes the Flatpickr datepicker for pickup/delivery date selection.

  initializeDatePicker() {
    const dateInput = document.getElementById("pickupDate");
    if (dateInput) {
      if (typeof flatpickr === "undefined") {
        console.error("Flatpickr is not loaded");
        return;
      }
      flatpickr(dateInput, {
        minDate: "today",
        maxDate: new Date().fp_incr(7),
        dateFormat: "Y-m-d",
        onChange: (selectedDates, dateStr) => {
          this.checkoutData.pickupDate = dateStr;
        },
      });
    }
  }

  //Renders the cart summary and total in the checkout form.

  renderCartSummary() {
    const cartSummary = document.getElementById("cartSummary");
    const orderTotal = document.getElementById("orderTotal");
    if (!cartSummary || !orderTotal) return;

    if (this.cartItems.length === 0) {
      cartSummary.innerHTML = "<p>Your cart is empty.</p>";
      orderTotal.textContent = "₱0.00";
      return;
    }

    cartSummary.innerHTML = this.cartItems
      .map((item) => {
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        const name = item.name || "Unknown Item";

        // Show downpayment information for custom cakes
        if (item.isCustomCake && item.isDownpayment) {
          // Properly handle totalPrice which might be a string or number
          const totalPrice =
            typeof item.totalPrice === "number"
              ? item.totalPrice
              : parseFloat(item.totalPrice) || this.customCakeOrder?.price || 0;

          return `
          <div class="mb-2">
            <div class="d-flex justify-content-between">
              <span>${name}${
            item.size ? ` (${item.size})` : ""
          } x${quantity}</span>
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
            <span>${name}${
            item.size ? ` (${item.size})` : ""
          } x${quantity}</span>
            <span>₱${(price * quantity).toFixed(2)}</span>
          </div>
        `;
        }
      })
      .join("");

    const total = this.cartItems.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + price * quantity;
    }, 0);

    orderTotal.textContent = `₱${total.toFixed(2)}`;

    // Add downpayment note for custom cakes
    if (this.isCustomCakeCheckout && this.customCakeData.isDownpayment) {
      // Use the actual total price from the order
      const totalPrice = this.customCakeOrder?.price
        ? parseFloat(this.customCakeOrder.price)
        : this.customCakeData.totalPrice
        ? parseFloat(this.customCakeData.totalPrice)
        : 0;

      cartSummary.innerHTML += `
        <div class="alert alert-info mt-3 mb-0">
          <small>
            <i class="fas fa-exclamation-circle"></i>
            <strong>Downpayment Notice:</strong> You are paying a 50% downpayment of ₱${total.toFixed(
              2
            )}. 
            The remaining balance of ₱${(totalPrice - total).toFixed(
              2
            )} will be paid upon pickup/delivery.
          </small>
        </div>
      `;
    }
  }

  //Updates the payment method in checkoutData.
  //@param {string} method - Selected payment method (cash or gcash).

  handlePaymentMethodChange(method) {
    this.checkoutData.paymentMethod = method;
    console.log("Payment method selected:", method);
  }
  //Updates the delivery method in checkoutData.
  //{string} method - Selected delivery method (pickup or delivery).

  handleDeliveryMethodChange(method) {
    this.checkoutData.deliveryMethod = method;
    console.log("Delivery method selected:", method);
    const dateInput = document.getElementById("pickupDate");
    if (dateInput) {
      dateInput.disabled = !method; // Enable datepicker only if a method is selected
      if (!method) this.checkoutData.pickupDate = null; // Clear date if no method
    }
  }

  //Handles order placement and payment processing.

  async placeOrder() {
    console.log("Payment method selected:", this.checkoutData.paymentMethod);
    console.log("Is custom cake checkout:", this.isCustomCakeCheckout);
    console.log("Is downpayment:", this.customCakeData?.isDownpayment);
    const checkoutBtn = document.querySelector(".checkout-btn");
    const statusMessage = document.getElementById("paymentStatusMessage");

    try {
      // Common validation
      const profile = this.customerProfile;
      const requiredFields = ["name", "email", "phone"];
      const missingFields = requiredFields.filter((field) => !profile[field]);

      if (missingFields.length > 0) {
        await Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: `Please complete your profile (${missingFields.join(
            ", "
          )}) before placing an order.`,
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/profile.html";
        return;
      }

      // NEW: Terms and Conditions validation
      const agreeTermsCheckbox = document.getElementById("agreeTerms");
      if (!agreeTermsCheckbox || !agreeTermsCheckbox.checked) {
        await Swal.fire({
          icon: "warning",
          title: "Terms and Conditions Required",
          html: `
          <div class="text-center">
            <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
            <p>Please agree to the Terms and Conditions to proceed with your order.</p>
            <small class="text-muted">You can review the terms by clicking the link above.</small>
          </div>
        `,
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      if (this.checkoutData.deliveryMethod === "delivery" && !profile.address) {
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Please provide a delivery address in your profile for home delivery.",
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/profile.html";
        return;
      }

      if (!this.checkoutData.pickupDate) {
        Swal.fire({
          icon: "warning",
          title: "Oops...",
          text: "Please select a delivery date.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      const token = sessionStorage.getItem("token");
      if (!token) {
        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Session expired. Please login again.",
          confirmButtonColor: "#2c9045",
        });
        window.location.href = "/customer/login.html";
        return;
      }

      // Disable button and show status
      if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML =
          '<i class="fas fa-spinner fa-spin"></i> Processing...';
      }

      if (statusMessage) {
        statusMessage.classList.remove("d-none");
        statusMessage.classList.add("show", "alert-info");
        const paymentType = this.customCakeData?.isDownpayment
          ? "downpayment"
          : "payment";
        document.getElementById(
          "paymentStatusText"
        ).textContent = `Processing your ${paymentType}...`;
      }

      // Build proper payment payload based on order type
      if (this.isCustomCakeCheckout) {
        await this.processCustomCakePayment(
          token,
          profile,
          checkoutBtn,
          statusMessage
        );
      } else {
        await this.processRegularOrderPayment(
          token,
          profile,
          checkoutBtn,
          statusMessage
        );
      }
    } catch (error) {
      console.error("Order placement failed:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: `Order failed: ${error.message}. Please try again.`,
        confirmButtonColor: "#2c9045",
      });
      this.resetCheckoutButton(checkoutBtn);
      this.hideStatusMessage(statusMessage);
    }
  }

  //Processes payment for custom cake orders.

  async processCustomCakePayment(token, profile, checkoutBtn, statusMessage) {
    const isDownpayment = this.customCakeData.isDownpayment;
    const amount = this.customCakeData.amount;

    // GCash minimum validation
    if (amount * 100 < 2000) {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Gcash payments require a minimum amount of ₱20.00.",
        confirmButtonColor: "#2c9045",
      });
      this.resetCheckoutButton(checkoutBtn);
      this.hideStatusMessage(statusMessage);
      return;
    }

    // Use underscore notation to match models
    const paymentPayload = {
      customCakeId: this.customCakeData.customCakeId,
      isImageOrder: this.customCakeData.isImageOrder,
      amount: amount * 100,
      isDownpayment: isDownpayment,
      deliveryDate: this.checkoutData.pickupDate,
      delivery_method: this.checkoutData.deliveryMethod,
      delivery_address:
        this.checkoutData.deliveryMethod === "delivery"
          ? profile.address
          : null,
      customerInfo: {
        fullName: profile.name,
        email: profile.email,
        phone: profile.phone,
      },
      description: `${
        this.customCakeData.isImageOrder ? "Image-based" : "3D"
      } Custom Cake ${isDownpayment ? "Downpayment (50%)" : "Full Payment"}`,
      redirect: {
        success: `${window.location.origin}/customer/success.html`,
        failed: `${window.location.origin}/customer/failed.html`,
      },
    };

    // Only store pending data after all validations pass
    sessionStorage.setItem(
      "pendingCustomCakeOrder",
      JSON.stringify({
        ...paymentPayload,
        totalAmount: amount,
        paymentMethod: this.checkoutData.paymentMethod,
      })
    );

    const paymentResponse = await fetch(
      `${window.API_BASE_URL}/api/payment/create-gcash-source`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentPayload),
      }
    );

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok || !paymentData.success) {
      throw new Error(paymentData.error || "Payment failed");
    }

    sessionStorage.setItem(
      "pendingPayment",
      JSON.stringify({
        paymentId: paymentData.paymentId,
        timestamp: Date.now(),
        paymentMethod: "gcash",
        isCustomCake: true,
        isDownpayment: isDownpayment,
      })
    );

    const paymentWindow = window.open(
      paymentData.checkoutUrl,
      "GCashPayment",
      "width=500,height=800,scrollbars=yes"
    );

    if (paymentWindow) {
      paymentWindow.focus();
      if (statusMessage) {
        const paymentType = isDownpayment ? "downpayment" : "payment";
        document.getElementById(
          "paymentStatusText"
        ).textContent = `Please complete the GCash ${paymentType} in the popup window...`;
      }
      this.startPaymentPolling();
    } else {
      throw new Error("Popup blocked! Please allow popups for this site.");
    }
  }

  //Processes payment for regular orders.
  async processRegularOrderPayment(token, profile, checkoutBtn, statusMessage) {
    const orderItems = this.cartItems.map((item) => ({
      menuId: item.menuId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      size: item.size || null,
      sizeId: item.sizeId || null,
    }));

    const totalAmount = orderItems.reduce((sum, item) => {
      return sum + (Number(item.price) || 0) * (Number(item.quantity) || 0);
    }, 0);

    if (totalAmount <= 0) {
      throw new Error("Total amount must be greater than zero");
    }

    // Store pending order
    sessionStorage.setItem(
      "pendingOrder",
      JSON.stringify({
        items: orderItems,
        totalAmount: totalAmount,
        paymentMethod: this.checkoutData.paymentMethod,
        deliveryMethod: this.checkoutData.deliveryMethod,
        pickupDate: this.checkoutData.pickupDate,
        customerInfo: {
          fullName: profile.name,
          email: profile.email,
          phone: profile.phone,
          deliveryAddress:
            this.checkoutData.deliveryMethod === "delivery"
              ? profile.address
              : null,
        },
      })
    );

    if (this.checkoutData.paymentMethod === "gcash") {
      // Validate minimum
      if (totalAmount * 100 < 2000) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "GCash payments require a minimum amount of ₱20.00.",
          confirmButtonColor: "#2c9045",
        });
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
          deliveryAddress:
            this.checkoutData.deliveryMethod === "delivery"
              ? profile.address
              : null,
        },
        description: "Regular Order",
        redirect: {
          success: `${window.location.origin}/customer/success.html`,
          failed: `${window.location.origin}/customer/failed.html`,
        },
      };

      const paymentResponse = await fetch(
        `${window.API_BASE_URL}/api/payment/create-gcash-source`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(paymentPayload),
        }
      );

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.error || "Payment failed");
      }

      sessionStorage.setItem(
        "pendingPayment",
        JSON.stringify({
          paymentId: paymentData.paymentId,
          timestamp: Date.now(),
          paymentMethod: "gcash",
          isCustomCake: false,
        })
      );

      const paymentWindow = window.open(
        paymentData.checkoutUrl,
        "GCashPayment",
        "width=500,height=800,scrollbars=yes"
      );

      if (paymentWindow) {
        paymentWindow.focus();
        // Only start polling for GCash payments
        this.startPaymentPolling();
      } else {
        throw new Error("Popup blocked! Please allow popups for this site.");
      }
    } else {
      // Cash payment - no polling needed
      const orderData = JSON.parse(sessionStorage.getItem("pendingOrder"));

      try {
        // Use the new cash payment endpoint instead of /api/orders/create
        const response = await fetch(
          `${window.API_BASE_URL}/api/payment/process-cash-order`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(orderData),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();

          // === NEW: SPECIFIC STOCK ERROR HANDLING ===
          if (
            errorData.error &&
            errorData.error.includes("Insufficient stock")
          ) {
            console.warn("Stock error detected:", errorData.error);

            await Swal.fire({
              icon: "warning",
              title: "Stock Update",
              html: `
              <div class="text-center">
                <i class="fas fa-exclamation-triangle fa-2x text-warning mb-3"></i>
                <p>Some items in your cart are no longer available in the requested quantities.</p>
                <p class="small text-muted">${errorData.error}</p>
              </div>
            `,
              confirmButtonText: "Update Cart",
              confirmButtonColor: "#2c9045",
            });

            // Reload cart to reflect current availability
            await this.loadCartItems();
            this.renderCartSummary();

            this.resetCheckoutButton(checkoutBtn);
            this.hideStatusMessage(statusMessage);

            // Clear pending order since it's invalid
            sessionStorage.removeItem("pendingOrder");
            return;
          }
          // === END NEW STOCK ERROR HANDLING ===

          throw new Error(errorData.message || "Order creation failed");
        }

        const result = await response.json();

        // Clear pending data for cash payment (no polling needed)
        sessionStorage.removeItem("pendingOrder");
        sessionStorage.removeItem("pendingPayment");

        // Redirect immediately for cash
        window.location.href = `/customer/success.html?orderId=${
          result.order.orderId || result.orderId
        }`;
      } catch (error) {
        // === NEW: ADDITIONAL ERROR HANDLING FOR STOCK ISSUES ===
        if (
          error.message.includes("stock") ||
          error.message.includes("Stock")
        ) {
          console.warn("Stock-related error:", error.message);

          await Swal.fire({
            icon: "warning",
            title: "Inventory Changed",
            text: "Product availability has changed. Please review your cart and try again.",
            confirmButtonColor: "#2c9045",
          });

          // Reload cart to get current stock status
          await this.loadCartItems();
          this.renderCartSummary();

          this.resetCheckoutButton(checkoutBtn);
          this.hideStatusMessage(statusMessage);

          // Clear invalid pending order
          sessionStorage.removeItem("pendingOrder");
          return;
        }

        // Re-throw other errors
        throw error;
      }
    }
  }

  // Resets the checkout button to its initial state.

  resetCheckoutButton(checkoutBtn) {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
    }
  }

  //Hides the payment status message.

  hideStatusMessage(statusMessage) {
    if (statusMessage) {
      statusMessage.classList.add("d-none");
      statusMessage.classList.remove("show");
    }
  }

  async handleReturnFromPaymongo() {
    const pendingPayment = sessionStorage.getItem("pendingPayment");
    const pendingOrder = sessionStorage.getItem("pendingOrder");
    const pendingCustomCakeOrder = sessionStorage.getItem(
      "pendingCustomCakeOrder"
    );

    if (!pendingPayment || (!pendingOrder && !pendingCustomCakeOrder)) {
      console.log("No pending payment found");
      return;
    }

    try {
      const paymentData = JSON.parse(pendingPayment);
      const { paymentId, isCustomCake, isDownpayment } = paymentData;
      const token = sessionStorage.getItem("token");

      // Verify payment status with retry logic
      let retries = 3;
      let response;

      while (retries > 0) {
        try {
          response = await fetch(
            `${window.API_BASE_URL}/api/payment/verify-payment/${paymentId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (response.ok) break;

          retries--;
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      if (!response.ok) {
        throw new Error("Payment verification failed after retries");
      }

      const result = await response.json();
      // Handle successful payment
      if (result.success && result.isPaid) {
        // Handle custom cake orders
        if (isCustomCake && pendingCustomCakeOrder) {
          const customCakeData = JSON.parse(pendingCustomCakeOrder);

          // Use different endpoint for downpayment vs full payment
          const verifyEndpoint = isDownpayment
            ? `${window.API_BASE_URL}/api/payment/verify-custom-cake-downpayment`
            : `${window.API_BASE_URL}/api/payment/verify-custom-cake-payment`;

          const verificationPayload = {
            paymentId,
            customCakeData: {
              customCakeId: customCakeData.customCakeId,
              isImageOrder: customCakeData.isImageOrder,
              deliveryDate: customCakeData.deliveryDate,
              delivery_method: customCakeData.delivery_method,
              delivery_address: customCakeData.delivery_address,
              customerInfo: customCakeData.customerInfo,
              totalAmount: isDownpayment
                ? null
                : customCakeData.totalAmount || customCakeData.amount / 100,
              downpaymentAmount: isDownpayment
                ? customCakeData.totalAmount || customCakeData.amount / 100
                : null,
            },
          };

          const updateResponse = await fetch(verifyEndpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(verificationPayload),
          });

          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error("Verification failed:", errorData);
            throw new Error(
              `Custom cake update failed: ${JSON.stringify(errorData)}`
            );
          }

          const updateResult = await updateResponse.json();

          // Clear session storage
          sessionStorage.removeItem("pendingPayment");
          sessionStorage.removeItem("pendingCustomCakeOrder");

          // Redirect to success page
          const downpaymentParam = isDownpayment ? `&isDownpayment=true` : "";
          window.location.href = `/customer/success.html?orderId=${customCakeData.customCakeId}&isCustomCake=true${downpaymentParam}`;
          return;
        }

        // Handle regular orders
        if (pendingOrder) {
          const orderData = JSON.parse(pendingOrder);

          // Create or update order
          const updateResponse = await fetch(
            `${window.API_BASE_URL}/api/orders/verify-gcash-payment`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                paymentId,
                orderData,
              }),
            }
          );

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Order creation failed: ${errorText}`);
          }

          const { order } = await updateResponse.json();

          // Clear session storage
          sessionStorage.removeItem("pendingPayment");
          sessionStorage.removeItem("pendingOrder");

          // Redirect to success page
          window.location.href = `/customer/success.html?orderId=${order.orderId}`;
        }
      } else if (result.status === "failed") {
        // Payment failed
        console.warn("Payment failed:", result);
        sessionStorage.removeItem("pendingPayment");
        sessionStorage.removeItem("pendingOrder");
        sessionStorage.removeItem("pendingCustomCakeOrder");
        window.location.href = "/customer/failed.html";
      } else {
        // Payment still pending
        console.log("Payment still pending, will retry...");
      }
    } catch (error) {
      console.error("Payment verification error:", error);

      // Show error message to user
      const statusMessage = document.getElementById("paymentStatusMessage");
      if (statusMessage) {
        statusMessage.classList.remove("alert-info", "d-none");
        statusMessage.classList.add("alert-danger", "show");
        document.getElementById("paymentStatusText").textContent =
          "Payment verification failed. Please check your orders page or contact support.";
      }
    }
  }

  //ID of the order to cancel.

  async cancelOrder(orderId) {
    const token = sessionStorage.getItem("token");
    if (!token) {
      console.warn("No token found, redirecting to login");
      window.location.href = "/customer/login.html";
      return;
    }

    try {
      const response = await fetch(
        `${window.API_BASE_URL}/api/orders/cancel/${orderId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to cancel order");
      const result = await response.json();
      await Swal.fire({
        icon: "error",
        title: "Canceled",
        text: "Order has been canceled.",
        confirmButtonColor: "#2c9045",
      });
      window.location.href = "/customer/cart.html";
    } catch (error) {
      console.error("Error canceling order:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error canceling order. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  }

  prefillDeliveryDate(deliveryDate) {
    const dateInput = document.getElementById("pickupDate");
    const dateLabel = document.querySelector('label[for="pickupDate"]');
    const dateSection = document.getElementById("deliveryDateSection"); // You might need to add this ID to your HTML

    if (!dateInput) return;

    // Format the date for the input field (YYYY-MM-DD)
    const formattedDate = new Date(deliveryDate).toISOString().split("T")[0];

    // Set the date value
    dateInput.value = formattedDate;
    this.checkoutData.pickupDate = formattedDate;

    // Disable the date picker
    dateInput.disabled = true;

    // Update label to show it's pre-filled
    if (dateLabel) {
      dateLabel.innerHTML =
        'Delivery Date <span class="text-muted">(Pre-selected from your order)</span>';
    }

    // Optional: Add a visual indicator
    if (dateSection) {
      dateSection.classList.add("prefilled-date");
    }

    console.log("Pre-filled delivery date from order:", formattedDate);
  }
}

// Instantiate the CheckoutManager
const checkoutManager = new CheckoutManager();
