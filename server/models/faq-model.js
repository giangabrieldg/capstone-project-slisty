const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Adjust path to your Sequelize config

const Faq = sequelize.define('Faq', {
  question: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  answer: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  timestamps: true,
});

module.exports = Faq;