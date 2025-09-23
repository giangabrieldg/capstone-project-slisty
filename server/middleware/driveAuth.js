/**
 * middleware/driveAuth.js
 * Middleware to check Google Drive authentication
 */
const googleDriveService = require('../utils/googleDrive');

async function checkDriveAuth(req, res, next) {
  try {
    await googleDriveService.ensureValidAccessToken();
    next();
  } catch (error) {
    console.error('Drive auth middleware error:', error);
    res.status(500).json({ 
      error: 'Google Drive service unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = checkDriveAuth;