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
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    dialect: 'mysql',
    logging: false,
    timezone: '+08:00', // Set timezone to +08:00
  }
);


// Export the sequelize instance for use in models and server
module.exports = sequelize;