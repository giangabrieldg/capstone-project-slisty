/**
 * For handling user authentication API endpoints
 * Supports creating, verifying, authenticating, and updating users account
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user-model');
const { Sequelize } = require('sequelize');
const { sendVerificationEmail } = require('../utils/sendEmail');
const verifyToken = require('../middleware/verifyToken');
require('dotenv').config();

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Define FRONTEND_URL based on environment
const FRONTEND_URL = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_URL_PROD || 'https://slice-n-grind.onrender.com')
  : (process.env.CLIENT_URL_LOCAL || 'http://localhost:3000');

console.log('FRONTEND_URL set to:', FRONTEND_URL);

// Middleware to set cache-control headers for protected routes
const setNoCacheHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Route to verify Google ID token
router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    let user = await User.findOne({ where: { googleID: payload.sub } });
    if (!user) {
      user = await User.findOne({ where: { email: payload.email } });
      if (user) {
        await user.update({ googleID: payload.sub, isVerified: true });
      } else {
        user = await User.create({
          googleID: payload.sub,
          email: payload.email,
          name: payload.name,
          isVerified: true,
          userLevel: 'Customer',
          isArchived: false,
        });
      }
    }

    if (user.isArchived) {
      return res.status(403).json({ message: 'Account is archived' });
    }

    const token = jwt.sign(
      { userID: user.userID, userLevel: user.userLevel },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: 'Google login successful',
      token,
      user: {
        name: user.name,
        userLevel: user.userLevel,
        email: user.email,
      },
      redirectUrl: user.userLevel === 'Admin'
        ? '/admin/admin-dashboard.html'
        : '/index.html',
    });
  } catch (error) {
    console.error('Error in Google login:', error);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// Route to handle login for all users
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Email not verified' });
    }

    if (user.isArchived) {
      return res.status(403).json({ message: 'Account is archived' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'This account uses Google Sign-In. Please use "Continue with Google".' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect username or password' });
    }

    const token = jwt.sign(
      { userID: user.userID, userLevel: user.userLevel },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );

    let redirectUrl;
    if (user.userLevel === 'Customer') {
      redirectUrl = '/index.html';
    } else if (user.userLevel === 'Staff') {
      redirectUrl = '/staff/staff.html';
    } else if (user.userLevel === 'Admin') {
      redirectUrl = '/admin/admin-dashboard.html';
    }

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        name: user.name,
        userLevel: user.userLevel,
      },
      redirectUrl,
      env: {
        nodeEnv: process.env.NODE_ENV,
        baseUrl: FRONTEND_URL
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ 
      message: 'Server error', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

// Route to submit email for customer signup
router.post('/signup-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: 'Email already registered and verified' });
      } else {
        // Resend verification email
        const token = jwt.sign(
          { userID: existingUser.userID, email: existingUser.email },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );
        await existingUser.update({ verificationToken: token });
        await sendVerificationEmail(email, token);
        return res.status(200).json({ message: 'Verification email resent' });
      }
    }

    // Create new user
    const user = await User.create({ email, isVerified: false, userLevel: 'Customer' });
    const token = jwt.sign(
      { userID: user.userID, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await user.update({ verificationToken: token });
    await sendVerificationEmail(email, token);

    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error in signup-email:', {
      message: error.message,
      stack: error.stack,
      email,
    });

    if (error.name === 'SequelizeUniqueConstraintError' || error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Email already registered' });
    }

    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

// Route to verify email via token for customer signup
router.get('/verify', async (req, res) => {
  try {
    const token = req.query.token;
    console.log('Token received in /verify route:', token);
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    await user.update({ isVerified: true, verificationToken: null });

    const newToken = jwt.sign({ userID: user.userID }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // Redirect to FRONTEND completion page
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? 'https://slice-n-grind.onrender.com'
      : 'http://localhost:3000'; // Your frontend port

    const redirectUrl = `${frontendUrl}/customer/complete-registration.html?userID=${user.userID}&token=${newToken}`;
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Error in verify:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to complete customer registration
router.post('/complete-registration', async (req, res) => {
  const { name, phone, address, password } = req.body;
  const token = req.query.token;

  console.log('Complete registration request body:', req.body);

  if (!name || !address || !password || !token) {
    return res.status(400).json({ message: 'Name, address, password, and token are required' });
  }
  
  if (phone && !/^(\+63|0)9\d{9}$/.test(phone)) {
    return res.status(400).json({ message: 'Please enter a valid Philippine phone number (e.g., +639171234567 or 09171234567)' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    const user = await User.findByPk(decoded.userID);
    console.log('Found user:', user ? 'Yes' : 'No');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Email not verified' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Updating user with:', { name, phone, address });
    await user.update({ 
      name, 
      phone: phone || null, 
      address, 
      password: hashedPassword 
    });
    console.log('User updated successfully');

    res.status(200).json({ message: 'Registration completed successfully' });
  } catch (error) {
    console.error('Error in complete-registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to create staff account (admin only)
router.post('/create-staff', verifyToken, setNoCacheHeaders, async (req, res) => {
  if (req.user.userLevel !== 'Admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }

  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password, and role are required' });
  }

  if (!['Staff', 'Admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const staffCount = await User.count({
      where: { 
        userLevel: ['Staff', 'Admin'],
        employeeID: {
          [Sequelize.Op.ne]: null
        }
      }
    });

    const newEmployeeID = `E${(staffCount + 1).toString().padStart(3, '0')}`;

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      employeeID: newEmployeeID,
      userLevel: role,
      isVerified: true,
      isArchived: false,
    });

    res.status(201).json({ 
      message: 'Staff account created successfully',
      user: { employeeID: user.employeeID, name, email, role: user.userLevel }
    });
  } catch (error) {
    console.error('Error creating staff account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to fetch all users for admin user management
router.get('/users', verifyToken, setNoCacheHeaders, async (req, res) => {
  if (req.user.userLevel !== 'Admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }

  try {
    const users = await User.findAll({
      where: { userLevel: ['Staff', 'Admin'] },
      attributes: ['userID', 'employeeID', 'name', 'email', 'userLevel', 'isArchived'],
    });
    res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to archive/unarchive a user
router.put('/users/:id/archive', verifyToken, setNoCacheHeaders, async (req, res) => {
  if (req.user.userLevel !== 'Admin') {
    return res.status(403).json({ message: 'Access denied: Admins only' });
  }

  const { id } = req.params;
  const { isArchived } = req.body;

  try {
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({ isArchived });
    res.status(200).json({ message: `User ${isArchived ? 'archived' : 'unarchived'} successfully` });
  } catch (error) {
    console.error('Error updating archive status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to fetch user profile data
router.get('/profile', verifyToken, setNoCacheHeaders, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      userLevel: user.userLevel,
      employeeID: user.employeeID
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to update user profile
router.put('/profile/update', verifyToken, setNoCacheHeaders, async (req, res) => {
  const { name, phone, address } = req.body;

  if (!name || !address) {
    return res.status(400).json({ message: 'Name and address are required' });
  }

  try {
    const user = await User.findByPk(req.user.userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.update({
      name,
      phone: phone || null,
      address
    });

    res.status(200).json({
      message: 'Profile updated successfully',
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Temporary route for testing
router.post('/create-test-user', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash('test123', 10);
    const user = await User.create({
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      isVerified: true,
      userLevel: 'Customer'
    });
    res.json({ message: 'Test user created', email: 'test@example.com', password: 'test123' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;