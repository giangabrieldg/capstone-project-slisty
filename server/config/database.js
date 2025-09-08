const { Sequelize } = require('sequelize');
require('dotenv').config();

// Determine environment and use appropriate DB credentials
const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = {
  database: isProduction ? process.env.PROD_DB_NAME : process.env.DEV_DB_NAME,
  username: isProduction ? process.env.PROD_DB_USER : process.env.DEV_DB_USER,
  password: isProduction ? process.env.PROD_DB_PASSWORD : process.env.DEV_DB_PASSWORD,
  host: isProduction ? process.env.PROD_DB_HOST : process.env.DEV_DB_HOST,
  port: isProduction ? 
    (process.env.PROD_DB_PORT ? parseInt(process.env.PROD_DB_PORT) : 3306) : 
    (process.env.DEV_DB_PORT ? parseInt(process.env.DEV_DB_PORT) : 3306),
  dialect: 'mysql',
  logging: false,
  timezone: '+08:00',
  dialectOptions: isProduction ? {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  } : {}
};

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    timezone: dbConfig.timezone,
    dialectOptions: dbConfig.dialectOptions
  }
);

module.exports = sequelize;