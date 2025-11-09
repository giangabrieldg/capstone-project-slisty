const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Import models
const User = require("./user-model");
const ResetToken = require("./reset-token-model");
const MenuItem = require("./menu-item-model")(sequelize, DataTypes);
const ItemSize = require("./item-size-model")(sequelize, DataTypes);
const Cart = require("./cart-model")(sequelize, DataTypes);
const CartItem = require("./cart-item-model")(sequelize, DataTypes);
const Order = require("./order-model")(sequelize, DataTypes);
const OrderItem = require("./order-item-model")(sequelize, DataTypes);
const CustomCakeOrder = require("./custom-cake-model");
const ImageBasedOrder = require("./image-based-order-model");
const Notification = require("./notification")(sequelize, DataTypes);
const CakeOption = require("./cake-options-model")(sequelize, DataTypes);

// MenuItem ↔ ItemSize
MenuItem.hasMany(ItemSize, {
  foreignKey: "menuId",
  as: "sizes",
  constraints: true,
  foreignKeyConstraint: true,
});
ItemSize.belongsTo(MenuItem, {
  foreignKey: "menuId",
  as: "menuItem",
  constraints: true,
  foreignKeyConstraint: true,
});

// Cart ↔ CartItem
Cart.hasMany(CartItem, {
  foreignKey: "cartId",
  constraints: true,
  foreignKeyConstraint: true,
});
CartItem.belongsTo(Cart, {
  foreignKey: "cartId",
  constraints: true,
  foreignKeyConstraint: true,
});
CartItem.belongsTo(MenuItem, {
  foreignKey: "menuId",
  constraints: true,
  foreignKeyConstraint: true,
});
MenuItem.hasMany(CartItem, {
  foreignKey: "menuId",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ Order
User.hasMany(Order, {
  foreignKey: "userID",
  as: "orders",
  constraints: true,
  foreignKeyConstraint: true,
});
Order.belongsTo(User, {
  foreignKey: "userID",
  as: "customer",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ Order (for updater)
User.hasMany(Order, {
  foreignKey: "updatedBy",
  as: "updatedOrders",
  constraints: true,
  foreignKeyConstraint: true,
});
Order.belongsTo(User, {
  foreignKey: "updatedBy",
  as: "updater",
  constraints: true,
  foreignKeyConstraint: true,
});

// Order ↔ OrderItem
Order.hasMany(OrderItem, {
  foreignKey: "orderId",
  as: "orderItems",
  constraints: true,
  foreignKeyConstraint: true,
});
OrderItem.belongsTo(Order, {
  foreignKey: "orderId",
  constraints: true,
  foreignKeyConstraint: true,
});

// MenuItem ↔ OrderItem
MenuItem.hasMany(OrderItem, {
  foreignKey: "menuId",
  constraints: true,
  foreignKeyConstraint: true,
});
OrderItem.belongsTo(MenuItem, {
  foreignKey: "menuId",
  constraints: true,
  foreignKeyConstraint: true,
});

// ItemSize ↔ OrderItem
ItemSize.hasMany(OrderItem, {
  foreignKey: "sizeId",
  constraints: true,
  foreignKeyConstraint: true,
});
OrderItem.belongsTo(ItemSize, {
  foreignKey: "sizeId",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ CustomCakeOrder
User.hasMany(CustomCakeOrder, {
  foreignKey: "userID",
  as: "customCakeOrders",
  constraints: true,
  foreignKeyConstraint: true,
});
CustomCakeOrder.belongsTo(User, {
  foreignKey: "userID",
  as: "customer",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ ImageBasedOrder
User.hasMany(ImageBasedOrder, {
  foreignKey: "userID",
  as: "imageBasedOrders",
  constraints: true,
  foreignKeyConstraint: true,
});
ImageBasedOrder.belongsTo(User, {
  foreignKey: "userID",
  as: "customer",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ CustomCakeOrder (for updater)
User.hasMany(CustomCakeOrder, {
  foreignKey: "updatedBy",
  as: "customCakesUpdatedByUser",
  constraints: true,
  foreignKeyConstraint: true,
});
CustomCakeOrder.belongsTo(User, {
  foreignKey: "updatedBy",
  as: "updater",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ ImageBasedOrder (for updater)
User.hasMany(ImageBasedOrder, {
  foreignKey: "updatedBy",
  as: "imageOrdersUpdatedByUser",
  constraints: true,
  foreignKeyConstraint: true,
});
ImageBasedOrder.belongsTo(User, {
  foreignKey: "updatedBy",
  as: "updater",
  constraints: true,
  foreignKeyConstraint: true,
});

// CartItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(CartItem, {
  foreignKey: "customCakeId",
  constraints: true,
  foreignKeyConstraint: true,
});
CartItem.belongsTo(CustomCakeOrder, {
  foreignKey: "customCakeId",
  constraints: true,
  foreignKeyConstraint: true,
});

// OrderItem ↔ CustomCakeOrder
CustomCakeOrder.hasMany(OrderItem, {
  foreignKey: "customCakeId",
  constraints: true,
  foreignKeyConstraint: true,
});
OrderItem.belongsTo(CustomCakeOrder, {
  foreignKey: "customCakeId",
  constraints: true,
  foreignKeyConstraint: true,
});

// OrderItem ↔ ImageBasedOrder
ImageBasedOrder.hasMany(OrderItem, {
  foreignKey: "imageOrderId",
  constraints: true,
  foreignKeyConstraint: true,
});
OrderItem.belongsTo(ImageBasedOrder, {
  foreignKey: "imageOrderId",
  as: "ImageBasedOrder",
  constraints: true,
  foreignKeyConstraint: true,
});

// User ↔ ResetToken
User.hasMany(ResetToken, {
  foreignKey: "userID",
  as: "resetTokens",
  constraints: true,
  foreignKeyConstraint: true,
});
ResetToken.belongsTo(User, {
  foreignKey: "userID",
  as: "user",
  constraints: true,
  foreignKeyConstraint: true,
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
  ImageBasedOrder,
  Notification,
  CakeOption,
};
