const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Initialize models
const MenuItem = require('./menu-item-model')(sequelize, DataTypes);
const ItemSize = require('./item-size-model')(sequelize, DataTypes); // Add this line
const Cart = require('./cart-model')(sequelize, DataTypes);
const CartItem = require('./cart-item-model')(sequelize, DataTypes);

// Define associations menuitem and itemsize
MenuItem.hasMany(ItemSize, { 
  foreignKey: 'menuId',
  as: 'sizes' // This matches what you're using in your routes
});
ItemSize.belongsTo(MenuItem, { 
  foreignKey: 'menuId',
  as: 'menuItem' 
});

// Define associations cart and cartitem
Cart.hasMany(CartItem, { foreignKey: 'cartId' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(MenuItem, { foreignKey: 'menuId' });
MenuItem.hasMany(CartItem, { foreignKey: 'menuId' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  MenuItem,
  ItemSize, // Add this to exports
  Cart,
  CartItem,
};