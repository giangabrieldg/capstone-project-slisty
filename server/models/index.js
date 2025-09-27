const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Import models
const User = require('./user-model');
const ResetToken = require('./reset-token-model');
const MenuItem = require('./menu-item-model')(sequelize, DataTypes);
const ItemSize = require('./item-size-model')(sequelize, DataTypes);
const Cart = require('./cart-model')(sequelize, DataTypes);
const CartItem = require('./cart-item-model')(sequelize, DataTypes);
const Order = require('./order-model')(sequelize, DataTypes);
const OrderItem = require('./order-item-model')(sequelize, DataTypes);
const CustomCakeOrder = require('./custom-cake-model');
const ImageBasedOrder = require('./image-based-order-model'); // Add this line

// MenuItem ↔ ItemSize
MenuItem.hasMany(ItemSize, { 
  foreignKey: 'menuId', 
  as: 'sizes', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_itemsize_menuitem_hasMany' 
});
ItemSize.belongsTo(MenuItem, { 
  foreignKey: 'menuId', 
  as: 'menuItem', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_itemsize_menuitem_belongsTo' 
});

// Cart ↔ CartItem
Cart.hasMany(CartItem, { 
  foreignKey: 'cartId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_cart_hasMany' 
});
CartItem.belongsTo(Cart, { 
  foreignKey: 'cartId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_cart_belongsTo' 
});
CartItem.belongsTo(MenuItem, { 
  foreignKey: 'menuId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_menuitem_belongsTo' 
});
MenuItem.hasMany(CartItem, { 
  foreignKey: 'menuId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_menuitem_hasMany' 
});

// User ↔ Order
User.hasMany(Order, { 
  foreignKey: 'userID', 
  as: 'orders', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_order_user_hasMany' 
});
Order.belongsTo(User, { 
  foreignKey: 'userID', 
  as: 'customer', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_order_user_belongsTo' 
});

// Order ↔ OrderItem
Order.hasMany(OrderItem, { 
  foreignKey: 'orderId', 
  as: 'orderItems', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_order_hasMany' 
});
OrderItem.belongsTo(Order, { 
  foreignKey: 'orderId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_order_belongsTo' 
});

// MenuItem ↔ OrderItem
MenuItem.hasMany(OrderItem, { 
  foreignKey: 'menuId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_menuitem_hasMany' 
});
OrderItem.belongsTo(MenuItem, { 
  foreignKey: 'menuId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_menuitem_belongsTo' 
});

// ItemSize ↔ OrderItem
ItemSize.hasMany(OrderItem, { 
  foreignKey: 'sizeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_itemsize_hasMany' 
});
OrderItem.belongsTo(ItemSize, { 
  foreignKey: 'sizeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_itemsize_belongsTo' 
});

// User ↔ CustomCakeOrder
User.hasMany(CustomCakeOrder, { 
  foreignKey: 'userID', 
  as: 'customCakeOrders', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_customcakeorder_user_hasMany' 
});
CustomCakeOrder.belongsTo(User, { 
  foreignKey: 'userID', 
  as: 'customer', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_customcakeorder_user_belongsTo' 
});

// User ↔ ImageBasedOrder (ADD THIS ASSOCIATION)
User.hasMany(ImageBasedOrder, { 
  foreignKey: 'userID', 
  as: 'imageBasedOrders', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_imagebasedorder_user_hasMany' 
});
ImageBasedOrder.belongsTo(User, { 
  foreignKey: 'userID', 
  as: 'customer', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_imagebasedorder_user_belongsTo' 
});

// CartItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(CartItem, { 
  foreignKey: 'customCakeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_customcake_hasMany' 
});
CartItem.belongsTo(CustomCakeOrder, { 
  foreignKey: 'customCakeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_cartitem_customcake_belongsTo' 
});

// OrderItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(OrderItem, { 
  foreignKey: 'customCakeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_customcake_hasMany' 
});
OrderItem.belongsTo(CustomCakeOrder, { 
  foreignKey: 'customCakeId', 
  constraints: true, 
  foreignKeyConstraint: true, 
  constraintName: 'fk_orderitem_customcake_belongsTo' 
});

// User ↔ ResetToken
User.hasMany(ResetToken, {
  foreignKey: 'userID',
  as: 'resetTokens',
  constraints: true,
  foreignKeyConstraint: true,
  constraintName: 'fk_resettoken_user_hasMany'
});
ResetToken.belongsTo(User, {
  foreignKey: 'userID',
  as: 'user',
  constraints: true,
  foreignKeyConstraint: true,
  constraintName: 'fk_resettoken_user_belongsTo'
});

module.exports = {
  sequelize,
  User,
  ResetToken,
  MenuItem,
  ItemSize,
  Cart,
  CartItem,
  Order,
  OrderItem,
  CustomCakeOrder,
  ImageBasedOrder, // Add this to exports
};