/**
 * Middleware to verify JWT token and set req.user with userID, userLevel, and email
 */
const jwt = require('jsonwebtoken');
const User = require('../models/user-model');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
  let token;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    console.log('Token received from header:', token);
  } else {
    console.log('No token provided in Authorization header');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    const user = await User.findByPk(decoded.userID);
    if (!user) {
      console.log('User not found for userID:', decoded.userID);
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Include email in req.user
    req.user = {
      userID: decoded.userID,
      userLevel: decoded.userLevel,
      email: user.email // Add email from User model
    };
    console.log('req.user set:', req.user);
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;