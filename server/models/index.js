const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Initialize models
const MenuItem = require('./menu-item-model')(sequelize, DataTypes);
const Cart = require('./cart-model')(sequelize, DataTypes);
const CartItem = require('./cart-item-model')(sequelize, DataTypes);

// Define associations
Cart.hasMany(CartItem, { foreignKey: 'cartId' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(MenuItem, { foreignKey: 'menuId' });
MenuItem.hasMany(CartItem, { foreignKey: 'menuId' });

// Export models and sequelize instance
module.exports = {
  sequelize,
  MenuItem,
  Cart,
  CartItem,
};