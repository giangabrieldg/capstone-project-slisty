// cake-api-service.js - Handles all API calls and backend interactions
class CakeAPIService {
  constructor() {
    this.baseURL = `${window.API_BASE_URL}/api/custom-cake`;
  }

  // Get authentication token from localStorage
  getToken() {
    return sessionStorage.getItem('token');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }

  // Redirect to login if not authenticated
  async requireAuth() {
    if (!this.isAuthenticated()) {
       await Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Please log in to submit a custom cake order",
        confirmButtonColor: "#2c9045"
      });
      window.location.href = '/customer/login.html';
      return false;
    }
    return true;
  }

  // NEW: Show beautiful modal for profile validation
  showProfileValidationModal(validationResult) {
    return new Promise((resolve) => {
      const modal = document.getElementById('profileValidationModal');
      const message = document.getElementById('profileModalMessage');
      const missingFieldsList = document.getElementById('missingFieldsList');
      const missingFieldsItems = document.getElementById('missingFieldsItems');
      const updateBtn = document.getElementById('updateProfileNow');
      const cancelBtn = document.getElementById('cancelProfileUpdate');

      // Set message
      message.textContent = validationResult.message;
      
      // Show missing fields if available
      if (validationResult.missingFields && validationResult.missingFields.length > 0) {
        missingFieldsItems.innerHTML = '';
        validationResult.missingFields.forEach(field => {
          const li = document.createElement('li');
          li.textContent = this.formatFieldName(field);
          missingFieldsItems.appendChild(li);
        });
        missingFieldsList.style.display = 'block';
      } else {
        missingFieldsList.style.display = 'none';
      }

      // Remove existing event listeners by cloning and replacing
      const newUpdateBtn = updateBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      
      updateBtn.parentNode.replaceChild(newUpdateBtn, updateBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

      // Add new event listeners
      newUpdateBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        resolve(true); // User wants to update profile
      });

      newCancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        resolve(false); // User doesn't want to update
      });

      // Show modal
      modal.style.display = 'block';

      // Close modal when clicking outside
      const outsideClickHandler = (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          modal.removeEventListener('click', outsideClickHandler);
          resolve(false);
        }
      };
      modal.addEventListener('click', outsideClickHandler);
    });
  }

  // Helper to format field names for display
  formatFieldName(field) {
    const fieldNames = {
      'name': 'Full Name',
      'email': 'Email Address',
      'phone': 'Phone Number',
      'address': 'Delivery Address'
    };
    return fieldNames[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }

  // Validate that user profile has all required fields
  async validateUserProfile() {
    if (!this.isAuthenticated()) {
      return { valid: false, message: 'Please log in first' };
    }

    const token = this.getToken();

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        return { 
          valid: false, 
          message: 'Unable to load your profile. Please try again.' 
        };
      }

      const profileData = await response.json();

      // Check for all required fields
      const requiredFields = ['name', 'email', 'phone', 'address'];
      const missingFields = requiredFields.filter(field => !profileData[field] || profileData[field].trim() === '');

      if (missingFields.length > 0) {
        return {
          valid: false,
          message: ToastNotifications.showToast(`Please complete your profile before checkout.`),
          missingFields
        };
      }

      return { valid: true, profileData };
    } catch (error) {
      console.error('Error validating profile:', error);
      return { 
        valid: false, 
        message: 'Error checking your profile. Please try again.' 
      };
    }
  }

  // UPDATED: Submit custom cake order with beautiful profile validation
  async submitCustomOrder(config, pricing, renderer) {
    if (!this.requireAuth()) return;

    // NEW: Validate profile before submitting with beautiful UI
    const profileValidation = await this.validateUserProfile();
    if (!profileValidation.valid) {
      const wantsToUpdate = await this.showProfileValidationModal(profileValidation);
      if (wantsToUpdate) {
        window.location.href = '/customer/profile.html';
      }
      return {
        success: false,
        error: 'Profile incomplete',
        message: profileValidation.message
      };
    }

    const formData = new FormData();
    const token = this.getToken();

    // Calculate price for immediate checkout
    const totalPrice = pricing.base[config.size] + pricing.fillings[config.filling];
    
    // Validate price for immediate checkout - FIXED LOGIC
    if (totalPrice && totalPrice > 0) {
      formData.append("price", totalPrice);
      formData.append("requiresReview", "false");
    } else {
      formData.append("requiresReview", "true");
    }

    // Capture 3D design as image
    try {
      const designImageDataUrl = await renderer.captureDesignImage();
      const response = await fetch(designImageDataUrl);
      const blob = await response.blob();
      formData.append("designImage", blob, "cake-design.png");
    } catch (error) {
      console.error("Error capturing 3D design:", error);
      // Continue without design image
    }

    // Add configuration data
    formData.append("size", config.size);
    formData.append("cakeColor", config.cakeColor);
    formData.append("icingStyle", config.icingStyle);
    formData.append("icingColor", config.icingColor);
    formData.append("filling", config.filling);
    formData.append("bottomBorder", config.bottomBorder);
    formData.append("topBorder", config.topBorder);
    formData.append("bottomBorderColor", config.bottomBorderColor);
    formData.append("topBorderColor", config.topBorderColor);
    formData.append("decorations", config.decorations);
    formData.append("flowerType", config.flowerType);
    formData.append("customText", config.customText);
    formData.append("messageChoice", config.messageChoice);
    formData.append("toppingsColor", config.toppingsColor);
    formData.append("price", totalPrice);
    formData.append("requiresReview", "false");

    // Load customer profile to get name, email, phone
    try {
      const profileResponse = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        formData.append("customer_name", profileData.name || "");
        formData.append("customer_email", profileData.email || "");
        formData.append("customer_phone", profileData.phone || "");
        formData.append("delivery_method", "pickup"); // Default to pickup
        formData.append("delivery_address", profileData.address || "");
      } else {
        console.error("Failed to load profile for customer info");
        return {
          success: false,
          error: "Failed to load customer profile",
          message: "Please complete your profile before ordering."
        };
      }
    } catch (error) {
      console.error("Error loading customer profile:", error);
      return {
        success: false,
        error: error.message,
        message: "Error loading your profile. Please try again."
      };
    }

    // Add reference image if uploaded
    const imageUpload = document.getElementById("imageUpload");
    if (imageUpload && imageUpload.files[0]) {
      formData.append("referenceImage", imageUpload.files[0]);
    }

    try {
      const response = await fetch(`${this.baseURL}/create?token=${encodeURIComponent(token)}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: "Custom cake order created successfully!"
      };
    } catch (error) {
      console.error("Error submitting order:", error);
      return {
        success: false,
        error: error.message,
        message: "Sorry, there was an error creating your order. Please try again."
      };
    }
  }

  // UPDATED: Submit image-based order with beautiful profile validation
  async submitImageBasedOrder(formElement) {
  // Prevent multiple submissions
  const submitButton = formElement.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  
  // Disable button and show loading state
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  submitButton.style.opacity = '0.7';
  
  try {
    if (!this.requireAuth()) return;

    // NEW: Validate profile before submitting with beautiful UI
    const profileValidation = await this.validateUserProfile();
    if (!profileValidation.valid) {
      const wantsToUpdate = await this.showProfileValidationModal(profileValidation);
      if (wantsToUpdate) {
        window.location.href = '/customer/profile.html';
      }
      return {
        success: false,
        error: 'Profile incomplete',
        message: profileValidation.message
      };
    }

    const token = this.getToken();
    const formData = new FormData();

    // Validate form inputs
    const flavor = formElement.querySelector('#imageFlavor').value.trim();
    const eventDate = formElement.querySelector('#eventDate').value;
    const message = formElement.querySelector('#imageMessage').value.trim();
    const notes = formElement.querySelector('#imageNotes').value.trim();
    const size = formElement.querySelector('#imageSize').value;
    const imageUpload = document.getElementById('imageUpload');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const selectedDate = new Date(eventDate);

    if (!flavor) {
      return {
        success: false,
        message: "Flavor is required."
      };
    }
    if (!eventDate || selectedDate < tomorrow) {
      return {
        success: false,
        message: "Event date must be tomorrow or later."
      };
    }
    if (!imageUpload || !imageUpload.files[0]) {
      return {
        success: false,
        message: "Reference image is required."
      };
    }

    // Add form fields to FormData
    formData.append('flavor', flavor);
    formData.append('size', size);
    formData.append('message', message);
    formData.append('notes', notes);
    formData.append('eventDate', eventDate);
    formData.append('image', imageUpload.files[0]);

    // Load customer profile to get name, email, phone
    try {
      const profileResponse = await fetch(`${window.API_BASE_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        formData.append("customer_name", profileData.name || "");
        formData.append("customer_email", profileData.email || "");
        formData.append("customer_phone", profileData.phone || "");
        formData.append("delivery_method", "pickup");
        formData.append("delivery_address", profileData.address || "");
      } else {
        console.error("Failed to load profile for customer info");
        return {
          success: false,
          error: "Failed to load customer profile",
          message: "Please complete your profile before ordering."
        };
      }
    } catch (error) {
      console.error("Error loading customer profile:", error);
      return {
        success: false,
        error: error.message,
        message: "Error loading your profile. Please try again."
      };
    }

    const response = await fetch(`${this.baseURL}/image-order?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error! Status: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // If we can't parse JSON error response, use default message
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    
    // Show success message
    await Swal.fire({
      icon: "success",
      title: "Success!",
      text: "Image-based order submitted successfully! Awaiting admin review.",
      confirmButtonColor: "#2c9045"
    });
    
    // Reset form after successful submission
    formElement.reset();
    document.getElementById('uploadedImage').style.display = 'none';
    document.getElementById('imageOrderForm').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    console.error("Error submitting image order:", error);
    await Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Error submitting order. Please try again.",
      confirmButtonColor: "#2c9045"
    });
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Re-enable button regardless of success or failure
    submitButton.disabled = false;
    submitButton.textContent = originalText;
    submitButton.style.opacity = '1';
  }
}

  // Process custom cake payment
  async processCustomCakePayment(customCakeId, isImageOrder, paymentMethod, amount, deliveryDate, deliveryMethod, customerInfo) {
    if (!this.requireAuth()) return;

    const token = this.getToken();

    try {
      if (paymentMethod === 'gcash') {
        const response = await fetch(`${window.API_BASE_URL}/api/payment/create-gcash-source`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customCakeId,
            isImageOrder,
            amount: amount * 100,
            description: isImageOrder ? 'Custom Image Cake Order' : '3D Custom Cake Order',
            deliveryDate,
            deliveryMethod,
            customerInfo,
            redirect: {
              success: `${window.location.origin}/customer/success.html`,
              failed: `${window.location.origin}/customer/failed.html`
            }
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // Store pending payment data
        sessionStorage.setItem('pendingPayment', JSON.stringify({
          paymentId: data.paymentId,
          timestamp: Date.now(),
          paymentMethod: 'gcash',
          isCustomCake: true,
          orderId: data.orderId
        }));

        return {
          success: true,
          data,
          message: "GCash payment initiated"
        };
      } else if (paymentMethod === 'cash') {
        const response = await fetch(`${window.API_BASE_URL}/api/custom-cake/process-cash-payment`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customCakeId,
            isImageOrder,
            pickupDate: deliveryDate,
            customerInfo,
            totalAmount: amount
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);

        return {
          success: true,
          data: result,
          message: "Cash order created successfully"
        };
      }
    } catch (error) {
      console.error("Payment processing error:", error);
      return {
        success: false,
        error: error.message,
        message: "Payment failed. Please try again."
      };
    }
  }

  async processCashPayment(customCakeId, isImageOrder, pickupDate, customerInfo, totalAmount) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    
    try {
      const response = await fetch(`${window.API_BASE_URL}/api/custom-cake/process-cash-payment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customCakeId,
          isImageOrder,
          pickupDate,
          customerInfo,
          totalAmount
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      return {
        success: true,
        data: result,
        message: "Cash payment processed successfully"
      };
    } catch (error) {
      console.error("Cash payment processing error:", error);
      return {
        success: false,
        error: error.message,
        message: "Cash payment failed. Please try again."
      };
    }
  }

  // Get user's custom orders
  async getCustomOrders() {
    if (!this.requireAuth()) return;

    const token = this.getToken();

    try {
      const [customResponse, imageResponse] = await Promise.all([
        fetch(`${this.baseURL}/orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${this.baseURL}/image-orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      let customData = { success: false, orders: [] };
      let imageData = { success: false, orders: [] };

      if (customResponse.ok) {
        customData = await customResponse.json();
      }

      if (imageResponse.ok) {
        imageData = await imageResponse.json();
      }

      const customOrders = customData.success ? customData.orders : [];
      const imageOrders = imageData.success ? imageData.orders : [];

      console.log('Loaded ALL custom orders:', {
        total3D: customOrders.length,
        totalImage: imageOrders.length,
        all3DOrders: customOrders.map(o => ({ id: o.customCakeId, status: o.status })),
        allImageOrders: imageOrders.map(o => ({ id: o.imageBasedOrderId, status: o.status }))
      });

      return {
        success: true,
        data: {
          customOrders,
          imageOrders
        }
      };
    } catch (error) {
      console.error("Error fetching custom orders:", error);
      return {
        success: false,
        error: error.message,
        message: "Error loading orders. Please try again."
      };
    }
  }

  // Delete custom order
  async deleteOrder(orderId, isImageOrder = false) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    const endpoint = isImageOrder ? `${this.baseURL}/image-orders/${orderId}` : `${this.baseURL}/${orderId}`;

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      return {
        success: true,
        message: "Order deleted successfully."
      };
    } catch (error) {
      console.error("Error deleting order:", error);
      return {
        success: false,
        error: error.message,
        message: "Error deleting order. Please try again."
      };
    }
  }

  // Get order details
  async getOrderDetails(orderId, isImageOrder = false) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    const endpoint = isImageOrder ? `${this.baseURL}/image-orders/${orderId}` : `${this.baseURL}/${orderId}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error("Error fetching order details:", error);
      return {
        success: false,
        error: error.message,
        message: "Error loading order details. Please try again."
      };
    }
  }

  async processCustomCakeCheckout(customCakeId, isImageOrder = false, paymentMethod, amount, deliveryDate, deliveryMethod, customerInfo) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    
    try {
      const paymentResponse = await this.processCustomCakePayment(
        customCakeId, 
        isImageOrder, 
        paymentMethod, 
        amount,
        deliveryDate,
        deliveryMethod,
        customerInfo
      );
      
      return paymentResponse;
    } catch (error) {
      console.error("Direct checkout error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Handle API response and show user feedback
  handleResponse(response, successCallback, errorCallback) {
    if (response.success) {
      if (response.message) {
        alert(response.message);
      }
      if (successCallback) {
        successCallback(response.data);
      }
    } else {
      if (response.message) {
        alert(response.message);
      }
      if (errorCallback) {
        errorCallback(response.error);
      }
    }
  }
}

// Export for use in other modules
window.CakeAPIService = CakeAPIService;