/**
 * Loads and displays cart items for the logged-in user.
 */
async function loadCartItems() {
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const token = sessionStorage.getItem('token');

  // Check if user is logged in
  if (!token) {
    cartItemsContainer.innerHTML = '<p class="text-muted">Please log in to view your cart.</p>';
    checkoutBtn.disabled = true;
    cartItemsContainer.innerHTML += '<p><a href="/customer/login.html" class="btn btn-primary">Log In</a></p>';
    return;
  }

  try {
    // Fetch cart items from the server
    const response = await fetch(`${window.API_BASE_URL}/api/cart`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log('Fetch /api/cart status:', response.status, response.statusText);
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Please log in again: Invalid or expired token');
      }
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Cart items response:', JSON.stringify(data.cartItems, null, 2));

    // Map cart items to display format using formatted fields from API
    const cartItems = data.cartItems.map(item => {
      return {
        cartItemId: item.cartItemId,
        name: item.name || 'Unknown', // Use API-provided name
        size: item.size || 'N/A', // Use API-provided size
        price: parseFloat(item.price) || 0, // Use API-provided price
        quantity: item.quantity,
        image: item.image || 'https://via.placeholder.com/300', // Use API-provided image
      };
    });

    // Display empty cart message if no items
    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML = '<p class="text-muted">Your cart is empty.</p>';
      checkoutBtn.disabled = true;
      return;
    }

    // Disable checkout if any item is invalid
    checkoutBtn.disabled = cartItems.some(item => item.name === 'Unknown' || item.price === 0);

    // Add checkout button event listener
    checkoutBtn.addEventListener('click', function() {
      window.location.href = '/customer/checkout.html';
    });

    // Build table for cart items
    let html = `
      <table class="table table-hover">
        <thead>
          <tr>
            <th scope="col">Image</th>
            <th scope="col">Item</th>
            <th scope="col">Size</th>
            <th scope="col">Price</th>
            <th scope="col">Quantity</th>
            <th scope="col">Total</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
    `;

    // Render each cart item
    cartItems.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const total = (price * item.quantity).toFixed(2);
      console.log('Processing cart item:', { name: item.name, size: item.size, price, total, image: item.image });

      html += `
        <tr>
          <td><img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover;"></td>
          <td>${item.name}</td>
          <td>${item.size}</td>
          <td>₱${price.toFixed(2)}</td>
          <td>${item.quantity}</td>
          <td>₱${total}</td>
          <td>
            <button class="btn btn-sm btn-danger remove-item" data-cart-item-id="${item.cartItemId}">Remove</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    cartItemsContainer.innerHTML = html;

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', async () => {
        const cartItemId = button.getAttribute('data-cart-item-id');
        try {
          const response = await fetch(`${window.API_BASE_URL}/api/cart/remove`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ cartItemId }),
          });
          if (response.ok) {
            alert('Item removed from cart');
            loadCartItems(); // Refresh cart
          } else {
            const result = await response.json();
            alert(`Failed to remove item: ${result.message}`);
          }
        } catch (error) {
          console.error('Remove item error:', error);
          if (error.message.includes('Invalid or expired token')) {
            alert('Your session has expired. Please log in again.');
            window.location.href = '/customer/login.html';
          } else {
            alert(`Error removing item: ${error.message}`);
          }
        }
      });
    });

  } catch (error) {
    console.error('Fetch cart error:', error.message);
    cartItemsContainer.innerHTML = `<p class="text-danger">Error loading cart: ${error.message}</p>`;
    if (error.message.includes('Invalid or expired token')) {
      cartItemsContainer.innerHTML += '<p><a href="/customer/login.html" class="btn btn-primary">Log In</a></p>';
    }
    checkoutBtn.disabled = true;
  }
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', loadCartItems);