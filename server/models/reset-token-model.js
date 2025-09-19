
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ResetToken = sequelize.define('ResetToken', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'userID'
    }
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'ResetTokens',
  timestamps: true
});

module.exports = ResetToken;
