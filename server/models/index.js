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

// Cart ↔ CartItem
Cart.hasMany(CartItem, { 
  foreignKey: 'cartId',
  constraintName: 'fk_cartitem_cart'
});
CartItem.belongsTo(Cart, { 
  foreignKey: 'cartId',
  constraintName: 'fk_cartitem_cart_belongsTo'
});
CartItem.belongsTo(MenuItem, { 
  foreignKey: 'menuId',
  constraintName: 'fk_cartitem_menuitem'
});
MenuItem.hasMany(CartItem, { 
  foreignKey: 'menuId',
  constraintName: 'fk_cartitem_menuitem_hasMany'
});

// User ↔ Order
User.hasMany(Order, { 
  foreignKey: 'userID', 
  as: 'orders',
  constraintName: 'fk_order_user'
});
Order.belongsTo(User, { 
  foreignKey: 'userID', 
  as: 'customer',
  constraintName: 'fk_order_user_belongsTo'
});

// Order ↔ OrderItem
Order.hasMany(OrderItem, { 
  foreignKey: 'orderId', 
  as: 'orderItems',
  constraintName: 'fk_orderitem_order'
});
OrderItem.belongsTo(Order, { 
  foreignKey: 'orderId',
  constraintName: 'fk_orderitem_order_belongsTo'
});

// MenuItem ↔ OrderItem
MenuItem.hasMany(OrderItem, { 
  foreignKey: 'menuId',
  constraintName: 'fk_orderitem_menuitem'
});
OrderItem.belongsTo(MenuItem, { 
  foreignKey: 'menuId',
  constraintName: 'fk_orderitem_menuitem_belongsTo'
});

// ItemSize ↔ OrderItem
ItemSize.hasMany(OrderItem, { 
  foreignKey: 'sizeId',
  constraintName: 'fk_orderitem_itemsize'
});
OrderItem.belongsTo(ItemSize, { 
  foreignKey: 'sizeId',
  constraintName: 'fk_orderitem_itemsize_belongsTo'
});

// User ↔ CustomCakeOrder
User.hasMany(CustomCakeOrder, { 
  foreignKey: 'userID', 
  as: 'customCakeOrders',
  constraintName: 'fk_customcakeorder_user'
});
CustomCakeOrder.belongsTo(User, { 
  foreignKey: 'userID', 
  as: 'customer',
  constraintName: 'fk_customcakeorder_user_belongsTo'
});

// CartItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(CartItem, { 
  foreignKey: 'customCakeId',
  constraintName: 'fk_cartitem_customcake'
});
CartItem.belongsTo(CustomCakeOrder, { 
  foreignKey: 'customCakeId',
  constraintName: 'fk_cartitem_customcake_belongsTo'
});

// OrderItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(OrderItem, { 
  foreignKey: 'customCakeId',
  constraintName: 'fk_orderitem_customcake'
});
OrderItem.belongsTo(CustomCakeOrder, { 
  foreignKey: 'customCakeId',
  constraintName: 'fk_orderitem_customcake_belongsTo'
});

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