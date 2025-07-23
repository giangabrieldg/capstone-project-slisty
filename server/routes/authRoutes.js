const express = require('express');
const jwt = require('jsonwebtoken'); // Keep this single import
const bcrypt = require('bcrypt');
const User = require('../models/user-model');
const { sendVerificationEmail } = require('../utils/sendEmail');
const verifyToken = require('../middleware/verifyToken');
require('dotenv').config();

const router = express.Router();

// Route to submit email for verification
router.post('/signup-email', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ email, isVerified: false, userLevel: 'Customer' });

    const token = jwt.sign({ userID: user.userID, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    await user.update({ verificationToken: token });

    await sendVerificationEmail(email, token);

    res.status(200).json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Error in signup-email:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to verify email via token
router.get('/verify', async (req, res) => {
  try {
    const token = req.query.token;
    console.log('Token received in /verify route:', token); // Log token for debugging
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    // Verify token
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
    console.log('New token generated for completion:', newToken);

    const redirectUrl = `http://localhost:3000/public/customer/complete-registration.html?userID=${user.userID}&token=${newToken}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in verify:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to complete registration with name and password
router.post('/complete-registration', async (req, res) => {
  const { name, password } = req.body;
  const token = req.query.token; // Get token from query

  if (!name || !password || !token) {
    return res.status(400).json({ message: 'Name, password, and token are required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: 'Email not verified' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ name, password: hashedPassword });

    res.status(200).json({ message: 'Registration completed successfully' });
  } catch (error) {
    console.error('Error in complete-registration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route to handle login
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

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Generate a login token
    const token = jwt.sign({ userID: user.userID, userLevel: user.userLevel }, process.env.JWT_SECRET, { expiresIn: '24h' });
    console.log('Login token generated:', token);

    // Return user data including name and userLevel
    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        name: user.name, // Include the user's name
        userLevel: user.userLevel // Include userLevel for frontend redirection
      }
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;