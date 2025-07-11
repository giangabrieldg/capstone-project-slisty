const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

const verifyToken = async (req, res, next) => {
  let token;

  // Check query parameter for token
  if (req.query.token) {
    token = req.query.token;
    console.log('Token received from query:', token);
  } else {
    console.log('No token provided in query');
    return res.status(400).json({ message: 'No token provided' });
  }

  try {
    // Verify token with JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    // Fetch user by userID from decoded token
    const user = await User.findByPk(decoded.userID);

    if (!user) {
      console.log('User not found for userID:', decoded.userID);
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = decoded; // Attach decoded user data to request
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
};

module.exports = verifyToken;