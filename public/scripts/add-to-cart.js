
// Add event listener for the "Add to Cart" button once the DOM is fully loaded
document.getElementById('addToCart').addEventListener('click', async () => {
  // Retrieve the authentication token from localStorage
  const token = localStorage.getItem('token');
  if (!token) {
    // Redirect to login page if user is not authenticated
    alert('Please log in to add items to your cart.');
    window.location.href = '/public/customer/login.html';
    return;
  }

  // Extract product ID from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  // Get the requested quantity from the input field
  const quantity = parseInt(document.getElementById('quantityInput').value);
  // Get the product name for success message
  const productName = document.getElementById('productName').textContent;

  // Validate quantity
  if (!quantity || quantity < 1) {
    alert('Please enter a valid quantity.');
    return;
  }

  // Initialize variables for size and stock
  let selectedSize = null;
  let selectedStock = null;

  console.log('Adding to cart:', { productId, quantity, size: selectedSize });

  try {
    // Fetch product details from the backend
    const response = await fetch(`http://localhost:3000/api/menu/${productId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product details: ${response.statusText}`);
    }
    const product = await response.json();

    // Handle stock validation based on whether the item has sizes
    if (product.hasSizes) {
      // For items with sizes, ensure a size is selected
      const activeSizeButton = document.querySelector('.size-btn.active');
      if (!activeSizeButton) {
        alert('Please select a size.');
        return;
      }
      selectedSize = activeSizeButton.dataset.size;
      // Find the selected size in the product's sizes array
      const validSize = product.sizes.find(
        s => s.sizeName.trim().toLowerCase() === selectedSize.trim().toLowerCase()
      );
      if (!validSize) {
        alert('Invalid size selected.');
        return;
      }
      // Get stock for the selected size
      selectedStock = validSize.stock;
      // Validate stock against requested quantity
      if (selectedStock < quantity) {
        alert(`Sorry, only ${selectedStock} items available for ${selectedSize}.`);
        return;
      }
    } else {
      // For non-sized items, use the main stock field
      selectedStock = product.stock || 0;
      if (selectedStock < quantity) {
        alert(`Sorry, only ${selectedStock} items available in stock.`);
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
    const cartResponse = await fetch('http://localhost:3000/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cartItem),
    });

    if (!cartResponse.ok) {
      const errorData = await cartResponse.json();
      throw new Error(errorData.message || `Failed to add to cart: ${cartResponse.statusText}`);
    }

    // Show success message with product name and size (if applicable)
    alert(`${productName}${selectedSize ? ` (${selectedSize})` : ''} added to cart!`);

    // Update cart count badge if updateCartCount function exists
    if (typeof updateCartCount === 'function') {
      updateCartCount();
    }
  } catch (error) {
    // Handle errors, including session expiration
    console.error('Error adding to cart:', error);
    if (error.message.includes('Invalid or expired token')) {
      alert('Your session has expired. Please log in again.');
      window.location.href = '/public/customer/login.html';
    } else {
      alert(`Error: ${error.message}`);
    }
  }
});
