
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Cart, CartItem, MenuItem, ItemSize } = require('../models');
const verifyToken = require('../middleware/verifyToken');

// POST /api/cart/add - Add item to cart
router.post('/add', verifyToken, async (req, res) => {
  try {
    // Extract menuId, quantity, and size from request body
    const { menuId, quantity, size } = req.body;
    // Validate input
    if (!menuId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid menuId or quantity' });
    }

    // Fetch menu item with associated sizes (if any)
    const menuItem = await MenuItem.findByPk(menuId, {
      include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
    });
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    let selectedStock = null;
    let validSize = null;

    // Validate stock based on whether the item has sizes
    if (menuItem.hasSizes) {
      // Size is required for items with hasSizes: true
      if (!size) {
        return res.status(400).json({ message: 'Size is required for this item' });
      }
      // Find the selected size in the sizes array
      validSize = menuItem.sizes.find(s => s.sizeName.trim().toLowerCase() === size.trim().toLowerCase());
      if (!validSize) {
        return res.status(400).json({ message: `Invalid size: ${size}` });
      }
      // Get stock for the selected size
      selectedStock = validSize.stock;
      // Validate stock against requested quantity
      if (selectedStock < quantity) {
        return res.status(400).json({ message: `Only ${selectedStock} items available for ${size}` });
      }
    } else {
      // For non-sized items, use the main stock field
      selectedStock = menuItem.stock || 0;
      if (selectedStock < quantity) {
        return res.status(400).json({ message: `Only ${selectedStock} items available in stock` });
      }
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      cart = await Cart.create({ userID: req.user.userID });
    }

    // Check if the item (with same size) already exists in cart
    let cartItem = await CartItem.findOne({
      where: { cartId: cart.cartId, menuId, size: size || null },
    });

    if (cartItem) {
      // Update quantity if item exists, and validate total quantity
      const newQuantity = cartItem.quantity + quantity;
      if (selectedStock < newQuantity) {
        return res.status(400).json({
          message: menuItem.hasSizes
            ? `Only ${selectedStock} items available for ${size}`
            : `Only ${selectedStock} items available in stock`,
        });
      }
      cartItem.quantity = newQuantity;
      await cartItem.save();
    } else {
      // Create new cart item
      cartItem = await CartItem.create({
        cartId: cart.cartId,
        menuId,
        quantity,
        size: size || null,
      });
    }

    // Return success response
    return res.status(200).json({ message: 'Item added to cart', cartItem });
  } catch (error) {
    // Handle server errors
    console.error('Add to cart error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/cart - Retrieve cart items for the authenticated user
router.get('/', verifyToken, async (req, res) => {
  try {
    // Find user's cart
    const cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      return res.status(200).json({ cartItems: [] });
    }
    // Fetch all cart items with associated menu item and sizes
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.cartId },
      include: [{
        model: MenuItem,
        include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
      }],
    });
    return res.status(200).json({ cartItems });
  } catch (error) {
    // Handle server errors
    console.error('Get cart error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/cart/update - Update cart item quantity
router.put('/update', verifyToken, async (req, res) => {
  try {
    // Extract cartItemId and quantity from request body
    const { cartItemId, quantity } = req.body;
    if (!cartItemId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid cartItemId or quantity' });
    }
    // Find cart item
    const cartItem = await CartItem.findByPk(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    // Find associated menu item
    const menuItem = await MenuItem.findByPk(cartItem.menuId, {
      include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
    });
    // Validate stock based on whether the item has sizes
    let selectedStock = null;
    if (menuItem.hasSizes && cartItem.size) {
      const validSize = menuItem.sizes.find(
        s => s.sizeName.trim().toLowerCase() === cartItem.size.trim().toLowerCase()
      );
      if (!validSize) {
        return res.status(400).json({ message: `Invalid size: ${cartItem.size}` });
      }
      selectedStock = validSize.stock;
      if (selectedStock < quantity) {
        return res.status(400).json({ message: `Only ${selectedStock} items available for ${cartItem.size}` });
      }
    } else {
      selectedStock = menuItem.stock || 0;
      if (selectedStock < quantity) {
        return res.status(400).json({ message: `Only ${selectedStock} items available in stock` });
      }
    }
    // Update cart item quantity
    cartItem.quantity = quantity;
    await cartItem.save();
    return res.status(200).json({ message: 'Cart item updated', cartItem });
  } catch (error) {
    // Handle server errors
    console.error('Update cart item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/cart/remove - Remove item from cart
router.delete('/remove', verifyToken, async (req, res) => {
  try {
    // Extract cartItemId from request body
    const { cartItemId } = req.body;
    if (!cartItemId) {
      return res.status(400).json({ message: 'Invalid cartItemId' });
    }
    // Find cart item
    const cartItem = await CartItem.findByPk(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    // Remove cart item
    await cartItem.destroy();
    return res.status(200).json({ message: 'Cart item removed' });
  } catch (error) {
    // Handle server errors
    console.error('Remove cart item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;