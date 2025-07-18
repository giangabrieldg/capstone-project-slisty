const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path if needed

const MenuItem = sequelize.define('MenuItem', {
  menuId: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sizes: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'MenuItems',
  timestamps: true,
});

module.exports = MenuItem;