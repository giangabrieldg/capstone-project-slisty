document.addEventListener('DOMContentLoaded', () => {
  const addToCartBtn = document.querySelector('.add-to-cart-btn');
  if (!addToCartBtn) return; // Exit if button not found

  // Handle quantity buttons
  document.querySelectorAll('.quantity-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      let value = parseInt(input.value);
      if (button.textContent === '-') value = Math.max(1, value - 1);
      if (button.textContent === '+') value += 1;
      input.value = value;
    });
  });

  // Add to cart functionality
  addToCartBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('Please log in to add items to cart.');
      window.location.href = '/public/customer/login.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const quantity = parseInt(document.getElementById('quantityInput')?.value) || 1;
    const selectedSizeBtn = document.querySelector('.size-btn.active');
    const selectedSize = selectedSizeBtn ? selectedSizeBtn.textContent.trim() : null;

    try {
      const response = await fetch('http://localhost:3000/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          menuId: parseInt(productId),
          quantity,
          size: selectedSize,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        alert('Item added to cart successfully!');
      } else {
        alert('Failed to add item to cart: ' + result.message);
      }
    } catch (error) {
      console.error('Add to cart error:', error);
      alert('Error adding item to cart');
    }
  });
});