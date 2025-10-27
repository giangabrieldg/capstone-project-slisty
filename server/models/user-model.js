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
    unique: true,
  },
  googleID: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
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
    defaultValue: false,
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastLoginAttempt: {
    type: DataTypes.DATE, 
    allowNull: true,
  },
  lockedUntil: {
    type: DataTypes.DATE, 
    allowNull: true,
  },
}, {
  tableName: 'Users',
  timestamps: true,
});

module.exports = User;