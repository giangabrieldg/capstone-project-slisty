// Import Sequelize
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define the User model with userID as the primary key
const User = sequelize.define('User', {
  userID: {
    type: DataTypes.INTEGER,
    primaryKey: true, // Set userID as the primary key
    autoIncrement: true, // Auto-increment for unique IDs
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Ensure email is unique
    validate: {
      isEmail: true, // Validate email format
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null until verification
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null until verification
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false, // User starts unverified
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true, // Stores JWT for email verification
  },
}, {
  timestamps: true, // Enable createdAt and updatedAt
  tableName: 'Users', // Explicitly set table name to match SQL
});

// Export the User model
module.exports = User;