const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Cart, CartItem, MenuItem, ItemSize } = require('../models'); // Include ItemSize
const verifyToken = require('../middleware/verifyToken');

// Add item to cart
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { menuId, quantity, size } = req.body;
    if (!menuId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid menuId or quantity' });
    }

    const menuItem = await MenuItem.findByPk(menuId);
    if (!menuItem) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    if (menuItem.stock < quantity) {
      return res.status(400).json({ message: `Only ${menuItem.stock} items available in stock` });
    }

    let cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      cart = await Cart.create({ userID: req.user.userID });
    }

    let cartItem = await CartItem.findOne({
      where: { cartId: cart.cartId, menuId, size: size || null },
    });

    if (cartItem) {
      const newQuantity = cartItem.quantity + quantity;
      if (menuItem.stock < newQuantity) {
        return res.status(400).json({ message: `Only ${menuItem.stock} items available in stock` });
      }
      cartItem.quantity = newQuantity;
      await cartItem.save();
    } else {
      cartItem = await CartItem.create({
        cartId: cart.cartId,
        menuId,
        quantity,
        size: size || null,
      });
    }

    return res.status(200).json({ message: 'Item added to cart', cartItem });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Get cart items for user
router.get('/', verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      return res.status(200).json({ cartItems: [] });
    }
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.cartId },
      include: [{
        model: MenuItem,
        include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
      }],
    });
    return res.status(200).json({ cartItems });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Update cart item quantity
router.put('/update', verifyToken, async (req, res) => {
  try {
    const { cartItemId, quantity } = req.body;
    if (!cartItemId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid cartItemId or quantity' });
    }
    const cartItem = await CartItem.findByPk(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    const menuItem = await MenuItem.findByPk(cartItem.menuId);
    if (menuItem.stock < quantity) {
      return res.status(400).json({ message: `Only ${menuItem.stock} items available in stock` });
    }
    cartItem.quantity = quantity;
    await cartItem.save();
    return res.status(200).json({ message: 'Cart item updated', cartItem });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Remove item from cart
router.delete('/remove', verifyToken, async (req, res) => {
  try {
    const { cartItemId } = req.body;
    if (!cartItemId) {
      return res.status(400).json({ message: 'Invalid cartItemId' });
    }
    const cartItem = await CartItem.findByPk(cartItemId);
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    await cartItem.destroy();
    return res.status(200).json({ message: 'Cart item removed' });
  } catch (error) {
    console.error('Remove cart item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;