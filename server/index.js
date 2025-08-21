const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/user-model.js');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS to allow both localhost and frontend Render URL
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://slice-n-grind.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Static file serving
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/styles', express.static(path.join(__dirname, '../public/styles')));
app.use('/scripts', express.static(path.join(__dirname, '../public/scripts')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));
app.use('/models', express.static(path.join(__dirname, '../public/models')));
app.use('/includes', express.static(path.join(__dirname, '../public/includes')));
app.use('/Uploads', express.static(path.join(__dirname, '../Uploads')));

const uploadDir = path.join(__dirname, '../Uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const sequelize = require('./config/database');

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
        username: 'admin',
        userLevel: 'Admin',
        isVerified: true,
        employeeID: 'E000'
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

// Backend Routes
try {
    const authRoutes = require('./routes/authRoutes');
    const menuRoutes = require('./routes/menu');
    const cartRoutes = require('./routes/cart');
    const inquiriesRoutes = require('./routes/inquiriesRoutes');
    const paymentRoutes = require('./routes/paymentRoutes');
    const orderRoutes = require('./routes/orderRoutes');
    const { cleanupAbandonedOrders } = require('./server-side-scripts/cleanup.js');

    console.log('Registering routes...');
    app.use('/api/inquiries', inquiriesRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/menu', menuRoutes);
    app.use('/api/cart', cartRoutes);
    app.use('/api/payment', paymentRoutes);
    app.use('/api/orders', orderRoutes);
    console.log('Routes registered successfully');

    cleanupAbandonedOrders();
} catch (error) {
    console.error('Error loading routes or cleanup:', error.message, error.stack);
}

// Test route to check server status
app.get('/', (req, res) => {
  console.log('GET / called');
  res.json({ message: 'Backend is running!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('General error:', err.message, err.stack);
  res.status(500).json({ error: err.message });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Unmatched route: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Route not found' });
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));

