const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: __dirname + '/../.env' });
const express = require('express');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use('/pages', express.static(path.join(__dirname, '../pages')));
app.use('/styles', express.static(path.join(__dirname, '../styles')));
app.use('/scripts', express.static(path.join(__dirname, '../scripts')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/uploads', express.static(path.join(__dirname, '../Uploads')));

const uploadDir = path.join(__dirname, '../Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

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
  .catch(err => console.error('Error connecting to MySQL:', err.message, err.stack));

// Create default admin user
async function createDefaultAdmin() {
  try {
    const adminEmail = 'admin@example.com';
    const adminPassword = 'Admin123!';
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        username: 'admin', // Add username to match model
        userLevel: 'Admin',
        isVerified: true, // Bypass email verification
      });
      console.log('Default admin user created:', adminEmail);
    } else {
      console.log('Admin user already exists:', adminEmail);
    }
  } catch (error) {
    console.error('Error creating default admin:', error.message, error.stack);
  }
}

sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced successfully');
    createDefaultAdmin();
  })
  .catch(err => console.error('Sync error:', err.message, err.stack));

const authRoutes = require('./routes/authRoutes');
const menuRoutes = require('./routes/menu');
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err.message);
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  } else if (err) {
    console.error('General error:', err.message, err.stack);
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.use((req, res) => {
  console.log(`404 - Unmatched route: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Route not found' });
});

app.listen(port, () => console.log(`Server running on port ${port}`));