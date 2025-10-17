const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const { Sequelize } = require('sequelize');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/user-model.js');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for production with security
// Configure CORS for production with security
const allowedOrigins = [
  'https://slice-n-grind.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

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
const customCakeUploadDir = path.join(__dirname, '../Uploads/custom-cakes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
if (!fs.existsSync(customCakeUploadDir)) {
  fs.mkdirSync(customCakeUploadDir, { recursive: true });
}

const sequelize = require('./config/database');

sequelize.authenticate()
  .then(() => console.log('Connected to MySQL'))
  .catch(err => console.error('Error connecting to MySQL:', err.message, err.stack));

// Create default admin user
async function createDefaultAdmin() {
  try {
    const adminEmail = 'admin2@test.com';
    const adminPassword = 'Admin123!';
    const existingAdmin = await User.findOne({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User2',
        username: 'admin2',
        userLevel: 'Admin',
        isVerified: true,
        employeeID: 'E001',
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
    console.log(`Database synced (${process.env.NODE_ENV} mode)`);
    if (process.env.NODE_ENV === 'production') {
      createDefaultAdmin();
    }
  })
  .catch(err => {
    console.error('Sync error:', {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
  });

// Backend Routes
try {
  const authRoutes = require('./routes/authRoutes');
  const menuRoutes = require('./routes/menu');
  const cartRoutes = require('./routes/cart');
  const inquiriesRoutes = require('./routes/inquiriesRoutes');
  const paymentRoutes = require('./routes/paymentRoutes');
  const orderRoutes = require('./routes/orderRoutes');
  const customCakeRoutes = require('./routes/customCakeRoutes');
  const { cleanupAbandonedOrders } = require('./server-side-scripts/cleanup.js');
  const faqRoutes = require('./routes/faqRoutes');
  const notificationRoutes = require('./routes/notificationRoutes');

  console.log('Registering routes...');
  app.use('/api/inquiries', inquiriesRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/menu', menuRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/payment', paymentRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/custom-cake', customCakeRoutes);
  app.use('/api/faqs', faqRoutes);
  app.use('/api/notifications', notificationRoutes);
  console.log('Routes registered successfully');

  // OAuth setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Route to initiate OAuth flow (for manual testing)
app.get('/auth/google', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    scope: ['https://www.googleapis.com/auth/drive.file'],
  });
  res.redirect(authUrl);
});

// OAuth callback route
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No auth code provided' });

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Access Token:', tokens.access_token);
    console.log('Refresh Token:', tokens.refresh_token);
    // TODO: Store tokens securely (e.g., in DB or env for testing)
    res.json({ message: 'Authentication successful! Check console for tokens.' });
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    res.status(400).json({ error: 'Authentication failed' });
  }
});
  
  
} catch (error) {
  console.error('Error loading routes or cleanup:', error.message, error.stack);
}

// Test route
app.get('/', (req, res) => {
  console.log('GET / called');
  res.json({ message: 'Backend is running!' });
});

// Error handling middleware
// Update error handling middleware
app.use((err, req, res, next) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Unmatched route: ${req.method} ${req.url}`);
  res.status(404).json({ message: 'Route not found' });
});


console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  BASE_URL_PROD: process.env.BASE_URL_PROD,
  CLIENT_URL_PROD: process.env.CLIENT_URL_PROD,
  PORT: port
});

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));
