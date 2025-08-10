document.getElementById('addToCart').addEventListener('click', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to add items to your cart.');
    window.location.href = '/public/customer/login.html';
    return;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  const quantity = parseInt(document.getElementById('quantityInput').value);
  const productName = document.getElementById('productName').textContent;

  if (!quantity || quantity < 1) {
    alert('Please enter a valid quantity.');
    return;
  }

  let selectedSize = null;

  try {
    const response = await fetch(`http://localhost:3000/api/menu/${productId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch product details: ${response.statusText}`);
    }
    const product = await response.json();

    // Check stock
    if (product.stock < quantity) {
      alert(`Sorry, only ${product.stock} items available in stock.`);
      return;
    }

    // Check if item has sizes
    if (product.hasSizes) {
      const activeSizeButton = document.querySelector('.size-btn.active');
      if (!activeSizeButton) {
        alert('Please select a size.');
        return;
      }
      selectedSize = activeSizeButton.dataset.size;
      // Validate size against available sizes
      const validSize = product.sizes.find(s => s.sizeName.trim().toLowerCase() === selectedSize.trim().toLowerCase());
      if (!validSize) {
        alert('Invalid size selected.');
        return;
      }
    }

    const cartItem = {
      menuId: productId,
      quantity,
      size: selectedSize,
    };

    // Send to backend
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

    alert(`${productName}${selectedSize ? ` (${selectedSize})` : ''} added to cart!`);

    // Update cart count badge
    if (typeof updateCartCount === 'function') {
      updateCartCount();
    }

  } catch (error) {
    console.error('Error adding to cart:', error);
    if (error.message.includes('Invalid or expired token')) {
      alert('Your session has expired. Please log in again.');
      window.location.href = '/public/customer/login.html';
    } else {
      alert(`Error: ${error.message}`);
    }
  }
});