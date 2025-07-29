// Handle adding a product to the cart
document.getElementById('addToCart').addEventListener('click', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  const quantity = parseInt(document.getElementById('quantityInput').value);
  const productName = document.getElementById('productName').textContent;
  const productPriceElement = document.getElementById('productPrice');
  const sizeContainer = document.getElementById('sizeContainer');

  let price;
  let selectedSize = null;

  try {
    const response = await fetch(`http://localhost:3000/api/menu/${productId}`);
    const product = await response.json();
    if (!response.ok) {
      alert('Failed to fetch product details.');
      return;
    }

    if (product.category === 'Cakes') {
      // For cakes, get the selected size and its price
      const activeSizeButton = document.querySelector('.size-btn.active');
      if (!activeSizeButton) {
        alert('Please select a size.');
        return;
      }
      selectedSize = activeSizeButton.dataset.size;
      price = Number(activeSizeButton.dataset.price);
    } else {
      // For non-cakes, use the single price
      price = Number(product.price);
    }

    // Create cart item object
    const cartItem = {
      id: productId,
      name: productName,
      size: selectedSize,
      price: price,
      quantity: quantity,
      image: product.image || '/assets/placeholder.jpg',
    };

    // Retrieve or initialize cart from localStorage
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existingItemIndex = cart.findIndex(
      item => item.id === productId && item.size === selectedSize
    );
    if (existingItemIndex >= 0) {
      // Update quantity if item exists
      cart[existingItemIndex].quantity += quantity;
    } else {
      // Add new item to cart
      cart.push(cartItem);
    }

    // Save cart to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    alert(`${productName}${selectedSize ? ` (${selectedSize})` : ''} added to cart!`);
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Error adding item to cart.');
  }
});