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
MenuItem.hasMany(ItemSize, { 
  foreignKey: 'menuId', 
  as: 'sizes',
  constraints: false  // ← ADD THIS
});

ItemSize.belongsTo(MenuItem, { 
  foreignKey: 'menuId', 
  as: 'menuItem',
  constraints: false  // ← ADD THIS
});

// Cart ↔ CartItem
Cart.hasMany(CartItem, { foreignKey: 'cartId', constraints: false});
CartItem.belongsTo(Cart, { foreignKey: 'cartId', constraints: false });
CartItem.belongsTo(MenuItem, { foreignKey: 'menuId', constraints: false});
MenuItem.hasMany(CartItem, { foreignKey: 'menuId', constraints: false});

// User ↔ Order
User.hasMany(Order, { foreignKey: 'userID', as: 'orders', constraints: false});
Order.belongsTo(User, { foreignKey: 'userID', as: 'customer', constraints: false});

// Order ↔ OrderItem
Order.hasMany(OrderItem, { foreignKey: 'orderId', as: 'orderItems', constraints: false });
OrderItem.belongsTo(Order, { foreignKey: 'orderId', constraints: false });

// MenuItem ↔ OrderItem
MenuItem.hasMany(OrderItem, { foreignKey: 'menuId', constraints: false });
OrderItem.belongsTo(MenuItem, { foreignKey: 'menuId', constraints: false });

// ItemSize ↔ OrderItem
ItemSize.hasMany(OrderItem, { foreignKey: 'sizeId', constraints: false });
OrderItem.belongsTo(ItemSize, { foreignKey: 'sizeId', constraints: false });

// User ↔ CustomCakeOrder
User.hasMany(CustomCakeOrder, { foreignKey: 'userID', as: 'customCakeOrders', constraints: false });
CustomCakeOrder.belongsTo(User, { foreignKey: 'userID', as: 'customer', constraints: false });

// CartItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(CartItem, { foreignKey: 'customCakeId', constraints: false });
CartItem.belongsTo(CustomCakeOrder, { foreignKey: 'customCakeId', constraints: false });

// OrderItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(OrderItem, { foreignKey: 'customCakeId', constraints: false });
OrderItem.belongsTo(CustomCakeOrder, { foreignKey: 'customCakeId', constraints: false });

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