const { Cart, CartItem, MenuItem, ItemSize, sequelize } = require("../models");

class CartCleanupService {
  /**
   * Clean up other users' carts when items are purchased
   * Removes or reduces cart items that exceed available stock
   */
  static async cleanupOtherUsersCarts(items, transaction) {
    try {
      const cleanupResults = {
        removedItems: [],
        reducedItems: [],
        errors: [],
      };

      for (const item of items) {
        if (item.menuId && !item.customCakeId) {
          try {
            const result = await this.cleanupItemCarts(item, transaction);
            cleanupResults.removedItems.push(...result.removedItems);
            cleanupResults.reducedItems.push(...result.reducedItems);
          } catch (error) {
            console.error(
              `Error cleaning up carts for item ${item.menuId}:`,
              error
            );
            cleanupResults.errors.push({
              itemId: item.menuId,
              error: error.message,
            });
          }
        }
      }

      this.logCleanupResults(cleanupResults);
      return cleanupResults;
    } catch (error) {
      console.error("Cart cleanup service error:", error);
      // Don't throw error - cart cleanup shouldn't block the payment
      return { removedItems: [], reducedItems: [], errors: [error.message] };
    }
  }

  /**
   * Clean up carts for a specific item
   */
  static async cleanupItemCarts(item, transaction) {
    const menuItem = await MenuItem.findByPk(item.menuId, {
      include: [
        {
          model: ItemSize,
          as: "sizes",
          where: { isActive: true },
          required: false,
        },
      ],
      transaction,
    });

    if (!menuItem) {
      return { removedItems: [], reducedItems: [] };
    }

    let currentStock = 0;
    let sizeCondition = {};

    if (menuItem.hasSizes && item.size) {
      const validSize = menuItem.sizes.find(
        (s) =>
          s.sizeName.trim().toLowerCase() === item.size.trim().toLowerCase()
      );
      if (validSize) {
        currentStock = validSize.stock;
        sizeCondition = { size: item.size };
      }
    } else {
      currentStock = menuItem.stock;
    }

    const result = {
      removedItems: [],
      reducedItems: [],
    };

    // If stock is zero or negative, remove this item from all other carts
    if (currentStock <= 0) {
      console.log(
        `Cleaning up cart items for ${item.name}${
          item.size ? ` (${item.size})` : ""
        } - stock: ${currentStock}`
      );

      // Find all cart items for this product that exceed current stock
      const excessCartItems = await CartItem.findAll({
        include: [
          {
            model: Cart,
            attributes: ["cartId", "userID"],
          },
        ],
        where: {
          menuId: item.menuId,
          customCakeId: null,
          ...sizeCondition,
        },
        transaction,
      });

      for (const cartItem of excessCartItems) {
        const cleanupResult = await this.processCartItemCleanup(
          cartItem,
          item,
          currentStock,
          transaction
        );
        if (cleanupResult.removed) {
          result.removedItems.push(cleanupResult);
        } else if (cleanupResult.reduced) {
          result.reducedItems.push(cleanupResult);
        }
      }
    }

    return result;
  }

  /**
   * Process cleanup for a single cart item
   */
  static async processCartItemCleanup(
    cartItem,
    item,
    currentStock,
    transaction
  ) {
    const excessQuantity = cartItem.quantity - Math.max(0, currentStock);

    if (excessQuantity > 0) {
      if (excessQuantity >= cartItem.quantity) {
        // Remove entire cart item if quantity completely exceeds stock
        await cartItem.destroy({ transaction });
        const result = {
          removed: true,
          userId: cartItem.Cart.userID,
          itemName: item.name,
          size: item.size,
          quantity: cartItem.quantity,
        };
        console.log(
          `Removed cart item for user ${result.userId} - ${item.name} x${cartItem.quantity}`
        );
        return result;
      } else {
        // Reduce quantity to match available stock
        const oldQuantity = cartItem.quantity;
        cartItem.quantity = Math.max(0, currentStock);
        await cartItem.save({ transaction });
        const result = {
          reduced: true,
          userId: cartItem.Cart.userID,
          itemName: item.name,
          size: item.size,
          oldQuantity,
          newQuantity: currentStock,
        };
        console.log(
          `Reduced cart item for user ${result.userId} - ${item.name} from ${oldQuantity} to ${currentStock}`
        );
        return result;
      }
    }

    return { noAction: true };
  }

  /**
   * Log cleanup results for monitoring
   */
  static logCleanupResults(results) {
    const totalActions =
      results.removedItems.length + results.reducedItems.length;

    if (totalActions > 0) {
      console.log(`Cart cleanup completed:`, {
        removedItems: results.removedItems.length,
        reducedItems: results.reducedItems.length,
        errors: results.errors.length,
      });

      if (results.removedItems.length > 0) {
        console.log(
          "📤 Removed items:",
          results.removedItems.map(
            (item) =>
              `${item.itemName} from user ${item.userId} (qty: ${item.quantity})`
          )
        );
      }

      if (results.reducedItems.length > 0) {
        console.log(
          "Reduced items:",
          results.reducedItems.map(
            (item) =>
              `${item.itemName} for user ${item.userId} (${item.oldQuantity} → ${item.newQuantity})`
          )
        );
      }
    } else {
      console.log("No cart cleanup needed - all items have sufficient stock");
    }

    if (results.errors.length > 0) {
      console.error("❌ Cart cleanup errors:", results.errors);
    }
  }

  /**
   * Validate and clean a specific user's cart
   * Useful for periodic cleanup or before checkout
   */
  static async validateUserCart(userId, transaction) {
    try {
      const cart = await Cart.findOne({
        where: { userID: userId },
        include: [
          {
            model: CartItem,
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
          },
        ],
        transaction,
      });

      if (!cart) {
        return { validated: true, removedItems: [], reducedItems: [] };
      }

      const results = {
        removedItems: [],
        reducedItems: [],
      };

      for (const cartItem of cart.CartItems) {
        if (cartItem.menuId && cartItem.MenuItem) {
          const itemResult = await this.validateCartItem(cartItem, transaction);
          if (itemResult.removed) results.removedItems.push(itemResult);
          if (itemResult.reduced) results.reducedItems.push(itemResult);
        }
      }

      return {
        validated: true,
        removedItems: results.removedItems,
        reducedItems: results.reducedItems,
      };
    } catch (error) {
      console.error("User cart validation error:", error);
      return {
        validated: false,
        error: error.message,
        removedItems: [],
        reducedItems: [],
      };
    }
  }

  /**
   * Validate a single cart item against current stock
   */
  static async validateCartItem(cartItem, transaction) {
    let availableStock = 0;
    const menuItem = cartItem.MenuItem;

    if (menuItem.hasSizes && cartItem.size) {
      const validSize = menuItem.sizes.find(
        (s) => s.sizeName === cartItem.size
      );
      availableStock = validSize ? validSize.stock : 0;
    } else {
      availableStock = menuItem.stock;
    }

    // If cart item quantity exceeds available stock
    if (cartItem.quantity > availableStock) {
      if (availableStock <= 0) {
        // Remove item completely if no stock
        await cartItem.destroy({ transaction });
        return {
          removed: true,
          itemName: menuItem.name,
          size: cartItem.size,
          quantity: cartItem.quantity,
        };
      } else {
        // Reduce quantity to match available stock
        const oldQuantity = cartItem.quantity;
        cartItem.quantity = availableStock;
        await cartItem.save({ transaction });
        return {
          reduced: true,
          itemName: menuItem.name,
          size: cartItem.size,
          oldQuantity,
          newQuantity: availableStock,
        };
      }
    }

    return { noAction: true };
  }
}

module.exports = CartCleanupService;
