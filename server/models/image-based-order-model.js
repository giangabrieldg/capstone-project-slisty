const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ImageBasedOrder = sequelize.define('ImageBasedOrder', {
  imageBasedOrderId: {
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
  // ADD SIZE FIELD
  size: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Cake size (e.g., 6x3, 8x4, 10x5)',
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
    type: DataTypes.ENUM('Pending Review', 'Feasible', 'Not Feasible', 'Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled'),
    defaultValue: 'Pending Review',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
    comment: 'Payment status for the order',
  },
  deliveryDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Scheduled delivery or pickup date',
  },
}, {
  tableName: 'ImageBasedOrders',
  timestamps: true,
});

module.exports = ImageBasedOrder;