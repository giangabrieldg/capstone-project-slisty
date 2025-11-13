// Fixed version with transaction handling
const express = require("express");
const router = express.Router();
const { Op, Sequelize } = require("sequelize");
const {
  Cart,
  CartItem,
  MenuItem,
  ItemSize,
  CustomCakeOrder,
  sequelize,
} = require("../models");
const verifyToken = require("../middleware/verifyToken");

// POST /api/cart/add - Add item or custom cake to cart with transaction
router.post("/add", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { menuId, customCakeId, quantity, size } = req.body;

    // Validate input
    if (!menuId && !customCakeId) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Either menuId or customCakeId is required" });
    }
    if (!quantity || quantity < 1) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid quantity" });
    }

    let menuItem = null;

    // Handle custom cake
    if (customCakeId) {
      const customCake = await CustomCakeOrder.findByPk(customCakeId, {
        transaction,
      });
      if (!customCake) {
        await transaction.rollback();
        return res.status(404).json({ message: "Custom cake order not found" });
      }
      if (customCake.status !== "Feasible") {
        await transaction.rollback();
        return res.status(400).json({
          message: "Custom cake order must be Feasible to add to cart",
        });
      }
    } else {
      // Handle menu item - use transaction and lock the row
      menuItem = await MenuItem.findByPk(menuId, {
        include: [
          {
            model: ItemSize,
            as: "sizes",
            where: { isActive: true },
            required: false,
          },
        ],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!menuItem) {
        await transaction.rollback();
        return res.status(404).json({ message: "Menu item not found" });
      }
    }

    // Find or create user's cart
    let cart = await Cart.findOne({
      where: { userID: req.user.userID },
      transaction,
    });

    if (!cart) {
      cart = await Cart.create({ userID: req.user.userID }, { transaction });
    }

    // Check for existing cart item
    let cartItem = await CartItem.findOne({
      where: {
        cartId: cart.cartId,
        menuId: menuId || null,
        size: size || null,
        customCakeId: customCakeId || null,
      },
      transaction,
    });

    if (cartItem) {
      // Update quantity if item exists
      const newQuantity = cartItem.quantity + quantity;

      // For existing items, we need to check stock considering the current cart quantity
      if (!customCakeId) {
        let currentStock = 0;

        if (menuItem.hasSizes && size) {
          // Lock and reload the size row to get current stock
          const lockedSize = await ItemSize.findOne({
            where: {
              menuId: menuId,
              sizeName: size,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!lockedSize) {
            await transaction.rollback();
            return res.status(400).json({ message: `Invalid size: ${size}` });
          }

          currentStock = lockedSize.stock;
        } else {
          // Lock and reload the menu item to get current stock
          const lockedMenuItem = await MenuItem.findByPk(menuId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          currentStock = lockedMenuItem.stock || 0;
        }

        // Check if new total quantity exceeds available stock
        if (currentStock < newQuantity) {
          await transaction.rollback();
          return res.status(409).json({
            message: menuItem.hasSizes
              ? `Only ${currentStock} items available for ${size}`
              : `Only ${currentStock} items available in stock`,
          });
        }
      } else if (newQuantity > 1) {
        await transaction.rollback();
        return res.status(400).json({
          message: "Only one custom cake order can be added",
        });
      }

      cartItem.quantity = newQuantity;
      await cartItem.save({ transaction });
    } else {
      // For new cart items, check stock availability
      if (!customCakeId) {
        let currentStock = 0;

        if (menuItem.hasSizes && size) {
          const validSize = menuItem.sizes.find(
            (s) => s.sizeName.trim().toLowerCase() === size.trim().toLowerCase()
          );

          if (!validSize) {
            await transaction.rollback();
            return res.status(400).json({ message: `Invalid size: ${size}` });
          }

          currentStock = validSize.stock;
        } else {
          currentStock = menuItem.stock || 0;
        }

        // Check if requested quantity exceeds available stock
        if (currentStock < quantity) {
          await transaction.rollback();
          return res.status(409).json({
            message: menuItem.hasSizes
              ? `Only ${currentStock} items available for ${size}`
              : `Only ${currentStock} items available in stock`,
          });
        }
      }

      // Create new cart item
      cartItem = await CartItem.create(
        {
          cartId: cart.cartId,
          menuId: menuId || null,
          customCakeId: customCakeId || null,
          quantity,
          size: size || null,
        },
        { transaction }
      );
    }

    // Commit the transaction
    await transaction.commit();

    return res.status(200).json({ message: "Item added to cart", cartItem });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Add to cart error:", error);

    // Handle specific database errors
    if (error.name === "Sequelize.TimeoutError") {
      return res.status(409).json({
        message: "Item is currently being processed. Please try again.",
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
});
// GET /api/cart - Retrieve cart items for the authenticated user
router.get("/", verifyToken, async (req, res) => {
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
          include: [
            {
              model: ItemSize,
              as: "sizes",
              where: { isActive: true },
              required: false,
            },
          ],
        },
        {
          model: CustomCakeOrder,
        },
      ],
    });
    // Format cart items for response
    const formattedItems = cartItems.map((item) => {
      let price = 0;
      if (item.MenuItem) {
        if (item.MenuItem.hasSizes && item.size) {
          const size = item.MenuItem.sizes.find(
            (s) => s.sizeName === item.size
          );
          price = size ? parseFloat(size.price) || 0 : 0;
        } else {
          // Prefer basePrice if available, fallback to price
          price =
            parseFloat(item.MenuItem.basePrice || item.MenuItem.price) || 0;
        }
      } else if (item.CustomCakeOrder) {
        price = parseFloat(item.CustomCakeOrder.price) || 0;
      }
      // Log to debug price issues
      console.log("Formatting cart item:", {
        cartItemId: item.cartItemId,
        menuId: item.menuId,
        size: item.size,
        price,
        hasMenuItem: !!item.MenuItem,
        hasSizes: item.MenuItem?.hasSizes,
        basePrice: item.MenuItem?.basePrice,
        priceField: item.MenuItem?.price,
      });
      return {
        cartItemId: item.cartItemId,
        menuId: item.menuId,
        customCakeId: item.customCakeId,
        quantity: item.quantity,
        size: item.size,
        name: item.MenuItem
          ? item.MenuItem.name
          : item.CustomCakeOrder
          ? `Custom Cake (${item.CustomCakeOrder.size})`
          : "Unknown",
        price: price.toFixed(2),
        image: item.MenuItem
          ? item.MenuItem.image
          : item.CustomCakeOrder?.imageUrl || "https://via.placeholder.com/300",
        customCakeDetails: item.CustomCakeOrder
          ? {
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
            }
          : null,
      };
    });
    return res.status(200).json({ cartItems: formattedItems });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// PUT /api/cart/update - Update cart item quantity with transaction
router.put("/update", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { cartItemId, quantity } = req.body;
    if (!cartItemId || !quantity || quantity < 1) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ message: "Invalid cartItemId or quantity" });
    }

    const cartItem = await CartItem.findByPk(cartItemId, {
      include: [
        {
          model: MenuItem,
          include: [
            {
              model: ItemSize,
              as: "sizes",
              where: { isActive: true },
              required: false,
            },
          ],
        },
        { model: CustomCakeOrder },
      ],
      transaction,
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({ message: "Cart item not found" });
    }

    let selectedStock = null;
    if (cartItem.customCakeId) {
      selectedStock = 1;
      if (quantity > 1) {
        await transaction.rollback();
        return res
          .status(400)
          .json({ message: "Only one custom cake order can be added" });
      }
    } else {
      const menuItem = cartItem.MenuItem;

      // Lock and reload the menu item to get current stock
      const lockedMenuItem = await MenuItem.findByPk(menuItem.menuId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (menuItem.hasSizes && cartItem.size) {
        const validSize = menuItem.sizes.find(
          (s) =>
            s.sizeName.trim().toLowerCase() ===
            cartItem.size.trim().toLowerCase()
        );
        if (!validSize) {
          await transaction.rollback();
          return res
            .status(400)
            .json({ message: `Invalid size: ${cartItem.size}` });
        }

        // Lock and reload the size row
        const lockedSize = await ItemSize.findByPk(validSize.sizeId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        selectedStock = lockedSize.stock;

        // Calculate available stock considering current cart quantity
        const currentReservedQuantity = cartItem.quantity;
        const availableStock = selectedStock + currentReservedQuantity;

        if (availableStock < quantity) {
          await transaction.rollback();
          return res.status(409).json({
            message: `Only ${selectedStock} items available for ${cartItem.size}`,
          });
        }

        // Update stock
        await ItemSize.update(
          { stock: selectedStock - (quantity - currentReservedQuantity) },
          {
            where: { sizeId: validSize.sizeId },
            transaction,
          }
        );
      } else {
        selectedStock = lockedMenuItem.stock || 0;

        // Calculate available stock considering current cart quantity
        const currentReservedQuantity = cartItem.quantity;
        const availableStock = selectedStock + currentReservedQuantity;

        if (availableStock < quantity) {
          await transaction.rollback();
          return res.status(409).json({
            message: `Only ${selectedStock} items available in stock`,
          });
        }

        // Update stock
        await MenuItem.update(
          { stock: selectedStock - (quantity - currentReservedQuantity) },
          {
            where: { menuId: menuItem.menuId },
            transaction,
          }
        );
      }
    }

    cartItem.quantity = quantity;
    await cartItem.save({ transaction });

    await transaction.commit();
    return res.status(200).json({ message: "Cart item updated", cartItem });
  } catch (error) {
    await transaction.rollback();
    console.error("Update cart item error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

// DELETE /api/cart/remove - Remove item from cart with transaction
router.delete("/remove", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { cartItemId } = req.body;
    if (!cartItemId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Invalid cartItemId" });
    }

    const cartItem = await CartItem.findByPk(cartItemId, {
      include: [
        {
          model: MenuItem,
          include: [
            {
              model: ItemSize,
              as: "sizes",
              where: { isActive: true },
              required: false,
            },
          ],
        },
      ],
      transaction,
    });

    if (!cartItem) {
      await transaction.rollback();
      return res.status(404).json({ message: "Cart item not found" });
    }

    await cartItem.destroy({ transaction });
    await transaction.commit();

    return res.status(200).json({ message: "Cart item removed" });
  } catch (error) {
    await transaction.rollback();
    console.error("Remove cart item error:", error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
