// Fixed version - Wait for SweetAlert to close before redirecting
document.getElementById("addToCart").addEventListener("click", async () => {
  // Retrieve the authentication token from sessionStorage
  const token = sessionStorage.getItem("token");
  if (!token) {
    // Show alert FIRST, then redirect AFTER user clicks OK
    await Swal.fire({
      icon: "error",
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
  const quantity = parseInt(document.getElementById("quantityInput").value);
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
  let selectedStock = null;

  console.log("Adding to cart:", { productId, quantity, size: selectedSize });

  try {
    // Fetch product details from the backend
    const response = await fetch(
      `${window.API_BASE_URL}/api/menu/${productId}`
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch product details: ${response.statusText}`
      );
    }
    const product = await response.json();

    // Handle stock validation based on whether the item has sizes
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
      selectedStock = validSize.stock;
      if (selectedStock < quantity) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: `Sorry, only ${selectedStock} items available for ${selectedSize}.`,
          confirmButtonColor: "#2c9045",
        });
        return;
      }
    } else {
      // For non-sized items, use the main stock field
      selectedStock = product.stock || 0;
      if (selectedStock < quantity) {
        Swal.fire({
          icon: "error",
          title: "Oops...",
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

    // Send cart item to backend
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
