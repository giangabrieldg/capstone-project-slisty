const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImageBasedOrder = sequelize.define('ImageBasedOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userID: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  imagePath: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  flavor: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  eventDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Pending Review', 'Feasible', 'Not Feasible'),
    defaultValue: 'Pending Review',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  tableName: 'ImageBasedOrders',
  timestamps: true,
});

module.exports = ImageBasedOrder;