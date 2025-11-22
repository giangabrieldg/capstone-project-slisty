/**
 * Middleware to verify JWT token and set req.user with userID, userLevel, and email
 */
const jwt = require("jsonwebtoken");
const User = require("../models/user-model");
require("dotenv").config();

const verifyToken = async (req, res, next) => {
  let token;

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
    console.log("Token received from header:", token);
  }
  // Check for token in query parameter (for file uploads with FormData)
  else if (req.query.token) {
    token = req.query.token;
    console.log("Token received from query parameter:", token);
  } else {
    console.log("No token provided in Authorization header");
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    const user = await User.findByPk(decoded.userID);
    if (!user) {
      console.log("User not found for userID:", decoded.userID);
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // NEW: Validate browser ID match
    if (
      user.currentBrowserId &&
      decoded.browserId &&
      user.currentBrowserId !== decoded.browserId
    ) {
      console.log(
        `Browser ID mismatch for user ${user.email}. Expected: ${user.currentBrowserId}, Got: ${decoded.browserId}`
      );

      // Auto-logout user due to browser mismatch
      await user.update({
        isLoggedIn: false,
        currentSessionId: null,
        currentBrowserId: null,
        lastActivity: null,
      });

      return res.status(401).json({
        success: false,
        message: "Session invalidated. Please login again.",
      });
    }

    // Check session inactivity (1 hour)
    if (user.lastActivity) {
      const inactivityTime = Date.now() - new Date(user.lastActivity).getTime();
      const maxInactivity = 60 * 60 * 1000; // 1 hour

      if (inactivityTime > maxInactivity) {
        console.log(
          `Session expired due to inactivity for user ${
            user.email
          }. Inactivity: ${Math.round(inactivityTime / 1000 / 60)} minutes`
        );

        // Auto-logout due to inactivity
        await user.update({
          isLoggedIn: false,
          currentSessionId: null,
          currentBrowserId: null,
          lastActivity: null,
        });

        return res.status(401).json({
          success: false,
          message: "Session expired due to inactivity. Please login again.",
        });
      }
    }

    // Check if session is valid
    if (!user.isLoggedIn || user.currentSessionId !== decoded.sessionId) {
      console.log("Invalid session - user logged out or session expired");
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    // Update last activity on successful verification
    user.lastActivity = new Date();
    await user.save();

    // Include email, sessionId, and browserId in req.user
    req.user = {
      userID: decoded.userID,
      userLevel: decoded.userLevel,
      email: user.email,
      sessionId: decoded.sessionId,
      browserId: decoded.browserId, // NEW: Include browserId
    };
    console.log("req.user set:", req.user);
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);

    // If token is expired, clear any potentially stale session data
    if (error.name === "TokenExpiredError") {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userID) {
          const user = await User.findByPk(decoded.userID);
          if (user) {
            await user.update({
              isLoggedIn: false,
              currentSessionId: null,
              currentBrowserId: null,
              lastActivity: null,
            });
          }
        }
      } catch (cleanupError) {
        console.error("Error during token cleanup:", cleanupError);
      }
    }

    return res
      .status(401)
      .json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = verifyToken;
