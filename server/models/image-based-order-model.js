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
  type: DataTypes.ENUM('Pending Review', 'Feasible', 'Ready for Downpayment', 'Downpayment Paid', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled', 'Not Feasible'),
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
  downpayment_amount: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,
  comment: '50% downpayment amount',
},
remaining_balance: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,
  comment: 'Remaining balance to be paid',
},
is_downpayment_paid: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
  comment: 'Whether downpayment has been paid',
},
downpayment_paid_at: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: 'When downpayment was paid',
},
final_payment_status: {
  type: DataTypes.ENUM('pending', 'paid'),
  allowNull: false,
  defaultValue: 'pending',
  comment: 'Final payment status after downpayment',
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