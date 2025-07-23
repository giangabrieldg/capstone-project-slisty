const verifyToken = require('./verifyToken');
const User = require('../models/user-model');

const authenticate = (roles = []) => async (req, res, next) => {
  try {
    // Use verifyToken to handle token verification
    await verifyToken(req, res, async () => {
      // Fetch user to get userLevel (since req.user is the decoded token without userLevel)
      const user = await User.findByPk(req.user.userID);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if specific roles (userLevels) are required
      // Changed from user.role to user.userLevel to match user model property
      if (roles.length && !roles.includes(user.userLevel)) {
        return res.status(403).json({ message: 'Unauthorized: Insufficient role' });
      }

      // Add userLevel to req.user for downstream use instead of role
      req.user = { ...req.user, userLevel: user.userLevel };
      next();
    });
  } catch (error) {
    console.error('Authentication error:', error.message);
    return res.status(400).json({ message: 'Authentication failed' });
  }
};

module.exports = { authenticate };
