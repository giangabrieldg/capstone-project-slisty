/**
 * For handling cart-related API endpoints.
 * Supports adding, retrieving, updating, and removing cart items, including custom cakes.
 */

const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Cart, CartItem, MenuItem, ItemSize, CustomCakeOrder } = require('../models');
const verifyToken = require('../middleware/verifyToken');

// POST /api/cart/add - Add item or custom cake to cart.
router.post('/add', verifyToken, async (req, res) => {
  try {
    const { menuId, customCakeId, quantity, size } = req.body;
    // Validate input
    if (!menuId && !customCakeId) {
      return res.status(400).json({ message: 'Either menuId or customCakeId is required' });
    }
    if (!quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    let selectedStock = null;
    let validSize = null;

    // Handle custom cake
    if (customCakeId) {
      const customCake = await CustomCakeOrder.findByPk(customCakeId);
      if (!customCake) {
        return res.status(404).json({ message: 'Custom cake order not found' });
      }
      if (customCake.status !== 'Feasible') {
        return res.status(400).json({ message: 'Custom cake order must be Feasible to add to cart' });
      }
      selectedStock = 1; // Custom cakes have a stock of 1
    } else {
      // Handle menu item
      const menuItem = await MenuItem.findByPk(menuId, {
        include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
      });
      if (!menuItem) {
        return res.status(404).json({ message: 'Menu item not found' });
      }
      if (menuItem.hasSizes) {
        if (!size) {
          return res.status(400).json({ message: 'Size is required for this item' });
        }
        validSize = menuItem.sizes.find(s => s.sizeName.trim().toLowerCase() === size.trim().toLowerCase());
        if (!validSize) {
          return res.status(400).json({ message: `Invalid size: ${size}` });
        }
        selectedStock = validSize.stock;
        if (selectedStock < quantity) {
          return res.status(400).json({ message: `Only ${selectedStock} items available for ${size}` });
        }
      } else {
        selectedStock = menuItem.stock || 0;
        if (selectedStock < quantity) {
          return res.status(400).json({ message: `Only ${selectedStock} items available in stock` });
        }
      }
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      cart = await Cart.create({ userID: req.user.userID });
    }

    // Check for existing cart item
    let cartItem = await CartItem.findOne({
      where: {
        cartId: cart.cartId,
        menuId: menuId || null,
        size: size || null,
        customCakeId: customCakeId || null,
      },
    });

    if (cartItem) {
      // Update quantity if item exists
      const newQuantity = cartItem.quantity + quantity;
      if (selectedStock < newQuantity) {
        return res.status(400).json({
          message: customCakeId
            ? 'Only one custom cake order can be added'
            : menuItem.hasSizes
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
        menuId: menuId || null,
        customCakeId: customCakeId || null,
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


// GET /api/cart - Retrieve cart items for the authenticated user
router.get('/', verifyToken, async (req, res) => {
  try {
    // Find user's cart
    const cart = await Cart.findOne({ where: { userID: req.user.userID } });
    if (!cart) {
      return res.status(200).json({ cartItems: [] });
    }
    // Fetch cart items with associated MenuItem and CustomCakeOrder
    const cartItems = await CartItem.findAll({
      where: { cartId: cart.cartId },
      include: [
        {
          model: MenuItem,
          include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
        },
        {
          model: CustomCakeOrder,
        },
      ],
    });
    // Format cart items for response
    const formattedItems = cartItems.map(item => {
      let price = 0;
      if (item.MenuItem) {
        if (item.MenuItem.hasSizes && item.size) {
          const size = item.MenuItem.sizes.find(s => s.sizeName === item.size);
          price = size ? parseFloat(size.price) || 0 : 0;
        } else {
          // Prefer basePrice if available, fallback to price
          price = parseFloat(item.MenuItem.basePrice || item.MenuItem.price) || 0;
        }
      } else if (item.CustomCakeOrder) {
        price = parseFloat(item.CustomCakeOrder.price) || 0;
      }
      // Log to debug price issues
      console.log('Formatting cart item:', {
        cartItemId: item.cartItemId,
        menuId: item.menuId,
        size: item.size,
        price,
        hasMenuItem: !!item.MenuItem,
        hasSizes: item.MenuItem?.hasSizes,
        basePrice: item.MenuItem?.basePrice,
        priceField: item.MenuItem?.price
      });
      return {
        cartItemId: item.cartItemId,
        menuId: item.menuId,
        customCakeId: item.customCakeId,
        quantity: item.quantity,
        size: item.size,
        name: item.MenuItem ? item.MenuItem.name : item.CustomCakeOrder ? `Custom Cake (${item.CustomCakeOrder.size})` : 'Unknown',
        price: price.toFixed(2),
        image: item.MenuItem ? item.MenuItem.image : item.CustomCakeOrder?.imageUrl || 'https://via.placeholder.com/300',
        customCakeDetails: item.CustomCakeOrder ? {
          size: item.CustomCakeOrder.size,
          cakeColor: item.CustomCakeOrder.cakeColor,
          icingStyle: item.CustomCakeOrder.icingStyle,
          icingColor: item.CustomCakeOrder.icingColor,
          filling: item.CustomCakeOrder.filling,
          bottomBorder: item.CustomCakeOrder.bottomBorder,
          topBorder: item.CustomCakeOrder.topBorder,
          bottomBorderColor: item.CustomCakeOrder.bottomBorderColor,
          topBorderColor: item.CustomCakeOrder.topBorderColor,
          decorations: item.CustomCakeOrder.decorations,
          flowerType: item.CustomCakeOrder.flowerType,
          customText: item.CustomCakeOrder.customText,
          messageChoice: item.CustomCakeOrder.messageChoice,
          toppingsColor: item.CustomCakeOrder.toppingsColor,
          imageUrl: item.CustomCakeOrder.imageUrl,
          status: item.CustomCakeOrder.status,
        } : null,
      };
    });
    return res.status(200).json({ cartItems: formattedItems });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/cart/update - Update cart item quantity.
router.put('/update', verifyToken, async (req, res) => {
  try {
    const { cartItemId, quantity } = req.body;
    if (!cartItemId || !quantity || quantity < 1) {
      return res.status(400).json({ message: 'Invalid cartItemId or quantity' });
    }
    const cartItem = await CartItem.findByPk(cartItemId, {
      include: [
        { model: MenuItem, include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }] },
        { model: CustomCakeOrder },
      ],
    });
    if (!cartItem) {
      return res.status(404).json({ message: 'Cart item not found' });
    }
    let selectedStock = null;
    if (cartItem.customCakeId) {
      selectedStock = 1;
      if (quantity > 1) {
        return res.status(400).json({ message: 'Only one custom cake order can be added' });
      }
    } else {
      const menuItem = cartItem.MenuItem;
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
    }
    cartItem.quantity = quantity;
    await cartItem.save();
    return res.status(200).json({ message: 'Cart item updated', cartItem });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// DELETE /api/cart/remove - Remove item from cart.
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