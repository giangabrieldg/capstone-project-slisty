
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user-model');
const ResetToken = require('../models/reset-token-model');
const { sendVerificationEmail } = require('../utils/sendEmail');
const verifyToken = require('../middleware/verifyToken');
const Sequelize = require('sequelize');
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

// Route to handle forgot password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isArchived) {
      return res.status(403).json({ message: 'Account is archived' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userID: user.userID, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token
    await ResetToken.create({
      userID: user.userID,
      token: resetToken,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour expiry
    });

    // Send reset email
    const resetUrl = `${FRONTEND_URL}/customer/reset-password.html?token=${resetToken}&email=${email}`;
    await sendVerificationEmail(email, resetToken, 'Password Reset Request - Slice N Grind', `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p style="color: #5e5d5d;">This link expires in 1 hour.</p>
        <p style="color: #5e5d5d;">If you can't click the button, copy this link:</p>
        <p style="font-size: 12px; word-break: break-all;">${resetUrl}</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
    `);

    res.status(200).json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to handle password reset
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Token and password are required' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = await ResetToken.findOne({ where: { userID: user.userID, token } });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword });

    // Delete used token
    await ResetToken.destroy({ where: { userID: user.userID } });

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

//Google Sign-In Route
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
      redirectUrl = '/staff/staff-dashboard.html';
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

router.post('/signup-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: 'Invalid email format' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: 'Email already registered and verified' });
      } else {
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

    const redirectUrl = `${FRONTEND_URL}/customer/complete-registration.html?userID=${user.userID}&token=${newToken}`;
    
    res.redirect(redirectUrl);
    
  } catch (error) {
    console.error('Error in verify:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

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

router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

router.get('/test-email', async (req, res) => {
  try {
    const { sendVerificationEmail } = require('../utils/sendEmail');
    res.json({ message: 'Email route accessible' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Email module error', 
      error: error.message 
    });
  }
});

module.exports = router;
