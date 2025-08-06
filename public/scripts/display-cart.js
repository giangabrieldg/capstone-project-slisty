// Load and display cart items for the logged-in user
async function loadCartItems() {
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const token = localStorage.getItem('token');

  // Check if user is logged in
  if (!token) {
    cartItemsContainer.innerHTML = '<p class="text-muted">Please log in to view your cart.</p>';
    checkoutBtn.disabled = true;
    cartItemsContainer.innerHTML += '<p><a href="/public/customer/login.html" class="btn btn-primary">Log In</a></p>';
    return;
  }

  try {
    // Fetch cart items from the server
    const response = await fetch('http://localhost:3000/api/cart', {
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
    const cartItems = data.cartItems.map(item => {
      const menuItem = item.MenuItem || {};
      let price = 0;
      // Handle price based on hasSizes
      if (menuItem.hasSizes && item.size && Array.isArray(menuItem.sizes)) {
        // Normalize size for comparison (case-insensitive, trim spaces)
        const normalizedSize = item.size?.trim().toLowerCase();
        const selectedSize = menuItem.sizes.find(
          s => s.sizeName?.trim().toLowerCase() === normalizedSize
        );
        if (selectedSize) {
          price = parseFloat(selectedSize.price) || 0;
          console.log(`Found size ${item.size} for ${menuItem.name}: ₱${price}`);
        } else {
          console.warn(`Size ${item.size} not found in sizes for ${menuItem.name}`, menuItem.sizes);
        }
      } else {
        // Parse basePrice as a number, handling string input
        price = parseFloat(String(menuItem.basePrice)) || 0;
        console.log(`Using basePrice for ${menuItem.name}: ₱${price}`);
      }
      return {
        cartItemId: item.cartItemId,
        name: menuItem.name || 'Unknown',
        size: item.size || 'N/A',
        price,
        quantity: item.quantity,
        image: menuItem.image || 'https://via.placeholder.com/300',
      };
    });

    // Display empty cart message if no items
    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML = '<p class="text-muted">Your cart is empty.</p>';
      checkoutBtn.disabled = true;
      return;
    }

    checkoutBtn.disabled = false;

    // Add checkout button event listener
    checkoutBtn.addEventListener('click', function() {
      window.location.href = '/public/customer/checkout.html';
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
          const response = await fetch('http://localhost:3000/api/cart/remove', {
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
            window.location.href = '/public/customer/login.html';
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
      cartItemsContainer.innerHTML += '<p><a href="/public/customer/login.html" class="btn btn-primary">Log In</a></p>';
    }
    checkoutBtn.disabled = true;
  }
}

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', loadCartItems);