module.exports = {
  // Maximum allowed login attempts before lockout
  MAX_LOGIN_ATTEMPTS: 5,
  
  // Lockout duration in minutes (30 minutes)
  LOCKOUT_DURATION: 30,
  
  // Auto-archive after lockout (for staff/admin only)
  AUTO_ARCHIVE_AFTER_LOCKOUT: true,
  
  // Reset attempts after successful login
  RESET_ATTEMPTS_ON_SUCCESS: true
};