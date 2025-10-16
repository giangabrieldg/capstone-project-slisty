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
  delivery_method: {
  type: DataTypes.ENUM('pickup', 'delivery'),
  allowNull: false,
  defaultValue: 'pickup'
  },
  delivery_address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customer_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customer_email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  customer_phone: {
    type: DataTypes.STRING,
    allowNull: false
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
  type: DataTypes.ENUM(
    'Pending Payment',     
    'Pending Review', 
    'Feasible', 
    'Ready for Downpayment', 
    'Downpayment Paid', 
    'In Progress', 
    'Ready for Pickup/Delivery', 
    'Completed', 
    'Cancelled', 
    'Not Feasible'
  ),
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
updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'userID'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    }
}, {
  tableName: 'ImageBasedOrders',
  timestamps: true,
});
ImageBasedOrder.associate = (models) => {
  ImageBasedOrder.belongsTo(models.User, { 
    foreignKey: 'userID', 
    as: 'customer' 
  });
  ImageBasedOrder.belongsTo(models.User, { 
    foreignKey: 'updatedBy', 
    as: 'updater' 
  });
};


module.exports = ImageBasedOrder;