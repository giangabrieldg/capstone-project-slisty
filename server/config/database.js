// Import Sequelize for database management
const { Sequelize } = require('sequelize');
require('dotenv').config(); // Load environment variables

// Initialize Sequelize with MySQL connection details from .env
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false, // Disable logging for cleaner console output
  }
);

// Export the sequelize instance for use in models and server
module.exports = sequelize;