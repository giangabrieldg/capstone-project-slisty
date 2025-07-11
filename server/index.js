require('dotenv').config({ path: __dirname + '/../.env' });

const express = require('express');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

app.use(bodyParser.json());

// Serve static files from the SLISTY/pages directory
const path = require('path');
app.use('/pages', express.static(path.join(__dirname, '../pages')));

// Serve static files for styles, scripts, and assets under /SLISTY path
app.use('/SLISTY/styles', express.static(path.join(__dirname, '../styles')));
app.use('/SLISTY/scripts', express.static(path.join(__dirname, '../scripts')));
app.use('/SLISTY/assets', express.static(path.join(__dirname, '../assets')));

console.log('Sequelize config - DB_NAME:', process.env.DB_NAME);
console.log('Sequelize config - DB_USER:', process.env.DB_USER);
console.log('Sequelize config - DB_PASSWORD:', process.env.DB_PASSWORD);
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql'
  }
);

sequelize.authenticate()
  .then(() => console.log('Connected to MySQL'))
  .catch(err => console.log('Error connecting to MySQL:', err));

// Sync database
sequelize.sync({ force: false })
  .then(() => console.log('Database synced'))
  .catch(err => console.log('Sync error:', err));

// Include your routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Catch-all route for unmatched requests
app.use((req, res) => {
  console.log(`404 - Unmatched route: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Route not found' });
});

app.listen(port, () => console.log(`Server running on port ${port}`));