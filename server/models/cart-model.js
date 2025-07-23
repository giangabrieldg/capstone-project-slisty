// Import Sequelize
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./user-model');

// Define Cart model linked to User
const Cart = sequelize.define('Cart', {
  cartId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'userID',
    },
  },
}, {
  timestamps: true,
  tableName: 'Carts',
});

// Associations
Cart.belongsTo(User, { foreignKey: 'userID' });
User.hasOne(Cart, { foreignKey: 'userID' });

module.exports = Cart;
