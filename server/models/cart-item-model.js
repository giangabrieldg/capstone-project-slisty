// Import Sequelize
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Cart = require('./cart-model');
const MenuItem = require('./menu-item-model');

// Define CartItem model linked to Cart and MenuItem
const CartItem = sequelize.define('CartItem', {
  cartItemId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  cartId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: Cart,
      key: 'cartId',
    },
  },
  menuId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: MenuItem,
      key: 'menuId',
    },
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  timestamps: true,
  tableName: 'CartItems',
});

// Associations
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
Cart.hasMany(CartItem, { foreignKey: 'cartId' });

CartItem.belongsTo(MenuItem, { foreignKey: 'menuId' });
MenuItem.hasMany(CartItem, { foreignKey: 'menuId' });

module.exports = CartItem;
