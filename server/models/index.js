const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Import models
const User = require('./user-model');
const MenuItem = require('./menu-item-model')(sequelize, DataTypes);
const ItemSize = require('./item-size-model')(sequelize, DataTypes);
const Cart = require('./cart-model')(sequelize, DataTypes);
const CartItem = require('./cart-item-model')(sequelize, DataTypes);
const Order = require('./order-model')(sequelize, DataTypes);
const OrderItem = require('./order-item-model')(sequelize, DataTypes);
const CustomCakeOrder = require('./custom-cake-model');

// MenuItem ↔ ItemSize
MenuItem.hasMany(ItemSize, { foreignKey: 'menuId', as: 'sizes' });
ItemSize.belongsTo(MenuItem, { foreignKey: 'menuId', as: 'menuItem' });

// Cart ↔ CartItem
Cart.hasMany(CartItem, { foreignKey: 'cartId' });
CartItem.belongsTo(Cart, { foreignKey: 'cartId' });
CartItem.belongsTo(MenuItem, { foreignKey: 'menuId' });
MenuItem.hasMany(CartItem, { foreignKey: 'menuId' });

// User ↔ Order
User.hasMany(Order, { foreignKey: 'userID', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userID', as: 'customer' });

// Order ↔ OrderItem
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'orderId' });

// MenuItem ↔ OrderItem
MenuItem.hasMany(OrderItem, { foreignKey: 'menuId' });
OrderItem.belongsTo(MenuItem, { foreignKey: 'menuId' });

// ItemSize ↔ OrderItem
ItemSize.hasMany(OrderItem, { foreignKey: 'sizeId' });
OrderItem.belongsTo(ItemSize, { foreignKey: 'sizeId' });

// User ↔ CustomCakeOrder
User.hasMany(CustomCakeOrder, { foreignKey: 'userID', as: 'customCakeOrders' });
CustomCakeOrder.belongsTo(User, { foreignKey: 'userID', as: 'customer' });

// CartItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(CartItem, { foreignKey: 'customCakeId' });
CartItem.belongsTo(CustomCakeOrder, { foreignKey: 'customCakeId' });

// OrderItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(OrderItem, { foreignKey: 'customCakeId' });
OrderItem.belongsTo(CustomCakeOrder, { foreignKey: 'customCakeId' });

module.exports = {
  sequelize,
  User,
  MenuItem,
  ItemSize,
  Cart,
  CartItem,
  Order,
  OrderItem,
  CustomCakeOrder,
};