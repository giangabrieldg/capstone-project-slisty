const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define User model with Sequelize
const User = sequelize.define('User', {
  userID: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  employeeID: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Ensure unique employee IDs for staff/admin
  },
  googleID: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true, // Store Google user ID
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userLevel: {
    type: DataTypes.ENUM('Customer', 'Staff', 'Admin'),
    defaultValue: 'Customer',
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // Default to active (not archived)
  },
}, {
  tableName: 'Users',
  timestamps: true,
});

module.exports = User;