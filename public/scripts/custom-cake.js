// cake-api-service.js - Handles all API calls and backend interactions
class CakeAPIService {
  constructor() {
    this.baseURL = '/api/custom-cake';
  }

  // Get authentication token from localStorage
  getToken() {
    return localStorage.getItem('token');
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getToken();
  }

  // Redirect to login if not authenticated
  requireAuth() {
    if (!this.isAuthenticated()) {
      alert('Please log in to submit a custom cake order');
      window.location.href = '/public/customer/login.html';
      return false;
    }
    return true;
  }

  // Submit custom cake order with 3D design
  // UPDATE the submitCustomOrder method in CakeAPIService:
  async submitCustomOrder(config, pricing, renderer) {
  if (!this.requireAuth()) return;

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

  // Set requiresReview to false for immediate checkout
  formData.append("requiresReview", "false");

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
      throw new Error(`HTTP error! Status: ${response.status}`);
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

  // UPDATED: Process custom cake payment (unified endpoint, pass deliveryDate)
async processCustomCakePayment(customCakeId, isImageOrder, paymentMethod, amount, deliveryDate, deliveryMethod, customerInfo) {
  if (!this.requireAuth()) return;

  const token = this.getToken();

  try {
    if (paymentMethod === 'gcash') {
      const response = await fetch('/api/payment/create-gcash-source', {
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
            success: `${window.location.origin}/public/customer/success.html`,
            failed: `${window.location.origin}/public/customer/failed.html`
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
      // Use the new cash payment endpoint in customCakeRoutes
      const response = await fetch('/api/custom-cake/process-cash-payment', {
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
    const response = await fetch('/api/custom-cake/process-cash-payment', {
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

  // Submit image-based order with Google Drive upload
async submitImageBasedOrder(formElement) {
  if (!this.requireAuth()) return;

  const token = this.getToken();
  const formData = new FormData();

  // Validate form inputs - ADD SIZE FIELD
  const flavor = formElement.querySelector('#imageFlavor').value.trim();
  const eventDate = formElement.querySelector('#eventDate').value;
  const message = formElement.querySelector('#imageMessage').value.trim();
  const notes = formElement.querySelector('#imageNotes').value.trim();
  const size = formElement.querySelector('#imageSize').value; // ADD SIZE
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

  // Add form fields to FormData - ADD SIZE
  formData.append('flavor', flavor);
  formData.append('size', size); // ADD SIZE FIELD
  formData.append('message', message);
  formData.append('notes', notes);
  formData.append('eventDate', eventDate);
  formData.append('image', imageUpload.files[0]);

  try {
    const response = await fetch(`${this.baseURL}/image-order?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      data: result,
      message: "Image-based order submitted successfully! Awaiting admin review."
    };
  } catch (error) {
    console.error("Error submitting image order:", error);
    return {
      success: false,
      error: error.message,
      message: "Error submitting order. Please try again."
    };
  }
}

  // UPDATED: Get user's custom orders (unified via /orders/user/me, filter for custom)
// In custom-cake.js - UPDATE the getCustomOrders method:
async getCustomOrders() {
  if (!this.requireAuth()) return;

  const token = this.getToken();

  try {
    // Fetch from both custom cake endpoints directly
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

    // SHOW ALL ORDERS - NO FILTERING
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
    // Process payment with all required parameters
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
      message: "Checkout failed. Please try again."
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