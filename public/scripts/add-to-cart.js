// Fixed version - Proper stock validation and race condition handling
document.getElementById("addToCart").addEventListener("click", async () => {
  // Retrieve the authentication token from sessionStorage
  const token = sessionStorage.getItem("token");
  if (!token) {
    // Show alert FIRST, then redirect AFTER user clicks OK
    await Swal.fire({
      icon: "warning",
      title: "Oops...",
      text: "Please log in to add items to your cart.",
      confirmButtonColor: "#2c9045",
    });
    // This runs AFTER the user clicks the OK button
    window.location.href = "/customer/login.html";
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id");
  const quantity = parseInt(
    document.getElementById("quantityDisplay").textContent
  );
  const productName = document.getElementById("productName").textContent;

  // Validate quantity
  if (!quantity || quantity < 1) {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Please enter a valid quantity.",
      confirmButtonColor: "#2c9045",
    });
    return;
  }

  // Initialize variables for size and stock
  let selectedSize = null;

  console.log("Adding to cart:", { productId, quantity, size: selectedSize });

  try {
    // Fetch current product details from the backend to check availability
    const response = await fetch(
      `${window.API_BASE_URL}/api/menu/${productId}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch product details: ${response.statusText}`
      );
    }
    const product = await response.json();

    // Handle size selection validation
    if (product.hasSizes) {
      // For items with sizes, ensure a size is selected
      const activeSizeButton = document.querySelector(".size-btn.active");
      if (!activeSizeButton) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Please select a size.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }
      selectedSize = activeSizeButton.dataset.size;
      // Find the selected size in the product's sizes array
      const validSize = product.sizes.find(
        (s) =>
          s.sizeName.trim().toLowerCase() === selectedSize.trim().toLowerCase()
      );
      if (!validSize) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Invalid size selected.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }
      // Get stock for the selected size
      const selectedStock = validSize.stock;
      if (selectedStock < quantity) {
        Swal.fire({
          icon: "error",
          title: "Stock Limit",
          text: `Sorry, only ${selectedStock} items available for ${selectedSize}.`,
          confirmButtonColor: "#2c9045",
        });
        return;
      }
    } else {
      // For non-sized items, use the main stock field
      const selectedStock = product.stock || 0;
      if (selectedStock < quantity) {
        Swal.fire({
          icon: "error",
          title: "Stock Limit",
          text: `Sorry, only ${selectedStock} items available in stock.`,
          confirmButtonColor: "#2c9045",
        });
        return;
      }
    }

    // Create cart item object
    const cartItem = {
      menuId: productId,
      quantity,
      size: selectedSize,
    };

    // Send cart item to backend - the backend should handle final stock validation
    const cartResponse = await fetch(`${window.API_BASE_URL}/api/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cartItem),
    });

    if (!cartResponse.ok) {
      const errorData = await cartResponse.json();

      // Handle specific error cases
      if (cartResponse.status === 403) {
        // This is the allowCustomerOnly middleware blocking Staff/Admin
        Swal.fire({
          icon: "error",
          title: "Access Denied",
          text: "Only customer accounts can add items to cart and make orders.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      // Handle specific error cases
      if (cartResponse.status === 409) {
        // Check if user already has this item in cart
        try {
          const cartCheckResponse = await fetch(
            `${window.API_BASE_URL}/api/cart`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );

          if (cartCheckResponse.ok) {
            const cartData = await cartCheckResponse.json();
            const existingCartItem = cartData.cartItems?.find(
              (item) =>
                item.menuId === parseInt(productId) &&
                item.size === selectedSize
            );

            if (existingCartItem) {
              // User already has this item in cart
              Swal.fire({
                icon: "warning",
                title: "Cart Limit",
                html: `
              <div class="text-center">
                <p>You already have <strong>${existingCartItem.quantity}</strong> of this item in your cart.</p>
                <p>Adding more would exceed the available stock limit.</p>
                <p class="small text-muted mt-2">Please adjust your cart quantity instead.</p>
              </div>
            `,
                confirmButtonColor: "#2c9045",
                confirmButtonText: "OK",
              });
              return;
            }
          }
        } catch (cartError) {
          console.error("Error checking cart:", cartError);
        }

        // Generic stock error
        Swal.fire({
          icon: "error",
          title: "Stock Issue",
          text: "This item is no longer available in the requested quantity.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      if (cartResponse.status === 400) {
        // Validation error
        Swal.fire({
          icon: "error",
          title: "Validation Error",
          text:
            errorData.message || "Please check your selection and try again.",
          confirmButtonColor: "#2c9045",
        });
        return;
      }

      throw new Error(
        errorData.message || `Failed to add to cart: ${cartResponse.statusText}`
      );
    }

    // Show success message with product name and size (if applicable)
    Swal.fire({
      title: "Success!",
      text: `${productName}${
        selectedSize ? ` (${selectedSize})` : ""
      } added to cart!`,
      icon: "success",
      confirmButtonColor: "#2c9045",
    });

    document.dispatchEvent(new Event("cartUpdate"));

    // Update cart count badge if updateCartCount function exists
    if (typeof updateCartCount === "function") {
      updateCartCount();
    }
  } catch (error) {
    // Handle errors, including session expiration
    console.error("Error adding to cart:", error);
    if (error.message.includes("Invalid or expired token")) {
      // Wait for SweetAlert before redirecting
      await Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Your session has expired. Please log in again.",
        confirmButtonColor: "#2c9045",
      });
      window.location.href = "/customer/login.html";
    } else {
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "Error adding item to cart. Please try again.",
        confirmButtonColor: "#2c9045",
      });
    }
  }
});
