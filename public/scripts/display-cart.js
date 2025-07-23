document.addEventListener('DOMContentLoaded', () => {
  const cartItemsContainer = document.querySelector('#cartItemsContainer');
  const checkoutBtn = document.querySelector('#checkoutBtn');

  // Fetch and display cart items
  async function loadCart() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        cartItemsContainer.innerHTML = '<p class="text-muted">Please log in to view your cart.</p>';
        checkoutBtn.disabled = true;
        return;
      }

      const response = await fetch('http://localhost:3000/api/cart', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        cartItemsContainer.innerHTML = `<p class="text-danger">Error: ${error.message}</p>`;
        checkoutBtn.disabled = true;
        return;
      }

      const { cartItems } = await response.json();
      renderCartItems(cartItems);
    } catch (error) {
      console.error('Error loading cart:', error);
      cartItemsContainer.innerHTML = '<p class="text-danger">Error loading cart.</p>';
      checkoutBtn.disabled = true;
    }
  }

  // Render cart items
  function renderCartItems(cartItems) {
    if (cartItems.length === 0) {
      cartItemsContainer.innerHTML = '<p class="text-muted">Your cart is empty.</p>';
      checkoutBtn.disabled = true;
      return;
    }

    let total = 0;
    cartItemsContainer.innerHTML = `
      <div class="list-group">
        ${cartItems
          .map((item) => {
            const itemPrice = item.MenuItem?.price || 0;
            const itemTotal = itemPrice * item.quantity;
            total += itemTotal;
            return `
              <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                  <h5 class="mb-1">${item.MenuItem?.name || 'Unknown Item'}</h5>
                  <p class="mb-1 text-muted">
                    ${item.size ? `Size: ${item.size}, ` : ''}Quantity: ${item.quantity}
                  </p>
                  <p class="mb-0">₱${itemTotal.toFixed(2)}</p>
                </div>
                <button class="btn btn-sm btn-danger remove-item" data-id="${item.cartItemId}">
                  Remove
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
      <div class="mt-3">
        <h4>Total: ₱${total.toFixed(2)}</h4>
      </div>
    `;

    checkoutBtn.disabled = false;

    // Add remove item functionality
    document.querySelectorAll('.remove-item').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const cartItemId = parseInt(e.target.dataset.id);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('http://localhost:3000/api/cart/remove', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ cartItemId }),
          });

          if (response.ok) {
            loadCart(); // Refresh cart
          } else {
            const error = await response.json();
            alert(`Failed to remove item: ${error.message}`);
          }
        } catch (error) {
          console.error('Error removing item:', error);
          alert('Error removing item');
        }
      });
    });
  }

  // Initialize cart
  loadCart();

  // Logout functionality (optional, for completeness)
  document.querySelector('#logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userLevel');
    window.location.href = '/public/customer/login.html';
  });
});