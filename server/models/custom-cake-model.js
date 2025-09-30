const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Defining the CustomCakeOrder model
const CustomCakeOrder = sequelize.define('CustomCakeOrder', {
  customCakeId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    comment: 'Unique identifier for the custom cake order',
  },
  userID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'Foreign key linking to the User who placed the order',
  },
  size: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Cake size (small, medium, large)',
  },
  cakeColor: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Cake flavor color hex code (e.g., #8B4513 for chocolate)',
  },
  icingStyle: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Icing style (buttercream, whipped)',
  },
  icingColor: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Icing color hex code',
  },
  filling: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Filling type (none, strawberry, bavarian)',
  },
  bottomBorder: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Bottom border style (none, beads, shells)',
  },
  topBorder: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Top border style (none, beads, shells)',
  },
  bottomBorderColor: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Bottom border color hex code',
  },
  topBorderColor: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Top border color hex code',
  },
  decorations: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Decoration type (none, flowers, balloons, toppings)',
  },
  flowerType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Flower type if decorations are flowers (none, daisies, buttonRoses)',
  },
  customText: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Custom message text',
  },
  messageChoice: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Message choice (none, custom)',
  },
  toppingsColor: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Toppings color hex code if decorations are toppings',
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL of the uploaded reference image',
  },
  designImageUrl: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: 'URL of the 3D design image',
  },
  status: {
  type: DataTypes.ENUM('Pending Review', 'Ready for Checkout', 'Pending', 'Ready', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled'),
  defaultValue: 'Pending',
},
  price: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,  
  comment: 'Final price after admin review or immediate pricing',
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
  tableName: 'CustomCakeOrders',
  timestamps: true,
  comment: 'Stores custom cake order details and status',
});

module.exports = CustomCakeOrder;