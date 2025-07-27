document.addEventListener('DOMContentLoaded', async () => {
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const token = localStorage.getItem('token');

  if (!token) {
    cartItemsContainer.innerHTML = '<p class="text-muted">Please log in to view your cart.</p>';
    checkoutBtn.disabled = true;
    console.log('No token found, user not logged in');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/cart', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('Fetch /api/cart status:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const { cartItems } = await response.json();
    console.log('Cart items response:', cartItems);

    if (!cartItems || cartItems.length === 0) {
      cartItemsContainer.innerHTML = '<p class="text-muted">Your cart is empty.</p>';
      checkoutBtn.disabled = true;
      return;
    }

    checkoutBtn.disabled = false;

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
      const menuItem = item.MenuItem || {};
      const imageUrl = menuItem.image || 'https://via.placeholder.com/300';
      const size = item.size || 'N/A';
      const price = parseFloat(menuItem.price) || 0;
      const total = (price * item.quantity).toFixed(2);

      console.log('Processing cart item:', { name: menuItem.name, size, price, imageUrl }); // Debug

      html += `
        <tr>
          <td><img src="${imageUrl}" alt="${menuItem.name || 'Item'}" style="width: 50px; height: 50px; object-fit: cover;"></td>
          <td>${menuItem.name || 'Unknown'}</td>
          <td>${size}</td>
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

    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', async () => {
        const cartItemId = button.getAttribute('data-cart-item-id');
        try {
          const response = await fetch('http://localhost:3000/api/cart/remove', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ cartItemId }),
          });
          if (response.ok) {
            alert('Item removed from cart');
            document.dispatchEvent(new Event('DOMContentLoaded'));
          } else {
            const result = await response.json();
            alert('Failed to remove item: ' + result.message);
          }
        } catch (error) {
          console.error('Remove item error:', error);
          alert('Error removing item from cart');
        }
      });
    });

  } catch (error) {
    console.error('Fetch cart error:', error.message);
    cartItemsContainer.innerHTML = '<p class="text-danger">Error loading cart. Please try again later.</p>';
    checkoutBtn.disabled = true;
  }
});