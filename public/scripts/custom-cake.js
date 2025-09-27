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
  async submitCustomOrder(config, pricing, renderer) {
    if (!this.requireAuth()) return;

    const formData = new FormData();
    const token = this.getToken();

    // Capture 3D design as image
    try {
      const designImageDataUrl = await renderer.captureDesignImage();
      const response = await fetch(designImageDataUrl);
      const blob = await response.blob();
      formData.append("designImage", blob, "cake-design.png");
    } catch (error) {
      console.error("Error capturing 3D design:", error);
      alert("Could not capture 3D design image, but order will still be submitted");
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
    const totalPrice = pricing.base[config.size] + pricing.fillings[config.filling];
    formData.append("price", totalPrice);

    // Add reference image if uploaded (local fallback)
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
        message: "Custom cake order submitted successfully! Awaiting admin review."
      };
    } catch (error) {
      console.error("Error submitting order:", error);
      return {
        success: false,
        error: error.message,
        message: "Sorry, there was an error submitting your order. Please try again."
      };
    }
  }

  // Submit image-based order with Google Drive upload
  async submitImageBasedOrder(formElement) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    const formData = new FormData();

    // Validate form inputs
    const flavor = formElement.querySelector('#imageFlavor').value.trim();
    const eventDate = formElement.querySelector('#eventDate').value;
    const message = formElement.querySelector('#imageMessage').value.trim();
    const notes = formElement.querySelector('#imageNotes').value.trim();
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

  // Get user's custom orders (both custom and image-based)
  async getCustomOrders() {
    if (!this.requireAuth()) return;

    const token = this.getToken();

    try {
      const [customResponse, imageResponse] = await Promise.all([
        fetch(`${this.baseURL}/orders?token=${encodeURIComponent(token)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${this.baseURL}/image-orders?token=${encodeURIComponent(token)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!customResponse.ok || !imageResponse.ok) {
        throw new Error(`HTTP error! Status: ${customResponse.status || imageResponse.status}`);
      }

      const customOrders = await customResponse.json();
      const imageOrders = await imageResponse.json();
      return {
        success: true,
        data: {
          customOrders: customOrders.orders,
          imageOrders: imageOrders.orders
        }
      };
    } catch (error) {
      console.error("Error fetching orders:", error);
      return {
        success: false,
        error: error.message,
        message: "Error loading your orders. Please try again."
      };
    }
  }

  // Update order status (for admin use)
  async updateOrderStatus(orderId, status, isImageOrder = false) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    const endpoint = isImageOrder ? `${this.baseURL}/image-orders/${orderId}` : `${this.baseURL}/${orderId}/status`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: "Order status updated successfully."
      };
    } catch (error) {
      console.error("Error updating order status:", error);
      return {
        success: false,
        error: error.message,
        message: "Error updating order status. Please try again."
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

  // Add approved cake to cart
  async addToCart(orderId, quantity = 1, isImageOrder = false) {
    if (!this.requireAuth()) return;

    const token = this.getToken();
    const endpoint = isImageOrder ? `${this.baseURL}/image-orders/${orderId}/add-to-cart` : `${this.baseURL}/${orderId}/add-to-cart`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ quantity })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: "Item added to cart successfully!"
      };
    } catch (error) {
      console.error("Error adding to cart:", error);
      return {
        success: false,
        error: error.message,
        message: "Error adding item to cart. Please try again."
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

  // Utility method to convert form data to FormData object
  createFormDataFromForm(formElement) {
    const formData = new FormData();
    const inputs = formElement.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
      if (input.type === 'file') {
        if (input.files.length > 0) {
          formData.append(input.name, input.files[0]);
        }
      } else if (input.type === 'checkbox') {
        if (input.checked) {
          formData.append(input.name, input.value);
        }
      } else if (input.type === 'radio') {
        if (input.checked) {
          formData.append(input.name, input.value);
        }
      } else {
        formData.append(input.name, input.value);
      }
    });
    
    return formData;
  }
}

// Export for use in other modules
window.CakeAPIService = CakeAPIService;