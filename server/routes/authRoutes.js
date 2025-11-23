//For handling authentication API endpoints.
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user-model");
const ResetToken = require("../models/reset-token-model");
const { sendVerificationEmail } = require("../utils/sendEmail");
const verifyToken = require("../middleware/verifyToken");
const securityConfig = require("../config/login-security");
const { sendStaffAccountEmail } = require("../utils/sendEmail");
const allowCustomerOnly = require("../middleware/checkOrderPermission");
const OTPService = require("../utils/otpService");
const Sequelize = require("sequelize");
require("dotenv").config();

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//Define FRONTEND_URL based on environment
const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL_PROD || "https://slice-n-grind.onrender.com"
    : process.env.CLIENT_URL_LOCAL || "http://localhost:3000";

console.log("FRONTEND_URL set to:", FRONTEND_URL);

//Middleware to set cache-control headers for protected routes
const setNoCacheHeaders = (req, res, next) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
};

const validateSession = async (req, res, next) => {
  if (req.user) {
    try {
      const user = await User.findByPk(req.user.userID);

      // Check if session is valid
      if (
        !user ||
        !user.isLoggedIn ||
        user.currentSessionId !== req.sessionID
      ) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }

      // Update last activity
      user.lastActivity = new Date();
      await user.save();
    } catch (error) {
      console.error("Session validation error:", error);
    }
  }
  next();
};

// Google Sign-In Route - PREVENTION APPROACH
router.post("/google", async (req, res) => {
  const { idToken, browserId } = req.body;

  if (!browserId) {
    return res.status(400).json({ message: "Browser ID is required" });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // FIRST: Check if this browser already has an active session with DIFFERENT user
    const activeUserInBrowser = await User.findOne({
      where: {
        currentBrowserId: browserId,
        isLoggedIn: true,
        email: { [Sequelize.Op.ne]: payload.email }, // ONLY prevent if DIFFERENT user
      },
    });

    if (activeUserInBrowser) {
      return res.status(409).json({
        message: `You are already logged in as ${activeUserInBrowser.email}. Please logout first to login with another account.`,
        alreadyLoggedIn: true,
        currentUser: {
          email: activeUserInBrowser.email,
          name: activeUserInBrowser.name,
        },
      });
    }

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
          userLevel: "Customer",
          isArchived: false,
        });
      }
    }

    if (user.isArchived) {
      return res.status(403).json({ message: "Account is archived" });
    }

    // Check if THIS user is already logged in elsewhere
    if (
      user.isLoggedIn &&
      user.currentSessionId &&
      user.currentBrowserId !== browserId
    ) {
      if (user.lastActivity) {
        const sessionAge = Date.now() - new Date(user.lastActivity).getTime();
        const maxSessionAge = 60 * 60 * 1000;

        if (sessionAge < maxSessionAge) {
          return res.status(409).json({
            message: `You are already logged in another browser/tab. Please logout there first or wait for session to expire.`,
            alreadyLoggedIn: true,
          });
        } else {
          await user.update({
            isLoggedIn: false,
            currentSessionId: null,
            currentBrowserId: null,
            lastActivity: null,
          });
        }
      }
    }

    const sessionId = require("crypto").randomBytes(16).toString("hex");

    // Update user with NEW browser ID
    await user.update({
      currentSessionId: sessionId,
      currentBrowserId: browserId,
      isLoggedIn: true,
      lastActivity: new Date(),
    });

    const token = jwt.sign(
      {
        userID: user.userID,
        userLevel: user.userLevel,
        sessionId: sessionId,
        browserId: browserId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Google login successful",
      token,
      user: {
        name: user.name,
        userLevel: user.userLevel,
        email: user.email,
        canOrder: user.userLevel === "Customer",
      },
      redirectUrl:
        user.userLevel === "Admin"
          ? "/admin/admin-dashboard.html"
          : user.userLevel === "Staff"
          ? "/staff/staff-dashboard.html"
          : "/index.html",
    });
  } catch (error) {
    console.error("Error in Google login:", error);
    res.status(401).json({ message: "Invalid Google token" });
  }
});

// Login Route - PREVENTION APPROACH
router.post("/login", async (req, res) => {
  const { email, password, browserId, otpCode } = req.body;

  if (!email || !browserId) {
    return res.status(400).json({
      message: "Email and browser ID are required",
    });
  }

  try {
    // FIRST: Check if this browser already has an active session with DIFFERENT user
    const activeUserInBrowser = await User.findOne({
      where: {
        currentBrowserId: browserId,
        isLoggedIn: true,
        email: { [Sequelize.Op.ne]: email }, // ONLY prevent if DIFFERENT user
      },
    });

    if (activeUserInBrowser) {
      return res.status(409).json({
        message: `You are already logged in as ${activeUserInBrowser.email}. Please logout first to login with another account.`,
        alreadyLoggedIn: true,
        currentUser: {
          email: activeUserInBrowser.email,
          name: activeUserInBrowser.name,
        },
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ message: "Incorrect username or Password" });
    }

    if (user.isArchived) {
      return res.status(403).json({
        message: "Account is archived. Please contact administrator.",
      });
    }

    // Check if THIS user is already logged in elsewhere
    if (
      user.isLoggedIn &&
      user.currentSessionId &&
      user.currentBrowserId !== browserId
    ) {
      if (user.lastActivity) {
        const sessionAge = Date.now() - new Date(user.lastActivity).getTime();
        const maxSessionAge = 60 * 60 * 1000;

        if (sessionAge < maxSessionAge) {
          return res.status(409).json({
            message: `You are already logged in another browser/tab. Please logout there first or wait for session to expire.`,
            alreadyLoggedIn: true,
          });
        } else {
          await user.update({
            isLoggedIn: false,
            currentSessionId: null,
            currentBrowserId: null,
            lastActivity: null,
          });
        }
      }
    }

    // Check if account is temporarily locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked. Try again in ${remainingTime} minutes.`,
      });
    }

    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      await user.update({
        lockedUntil: null,
        loginAttempts: 0,
      });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    // ✅ OTP VERIFICATION FLOW
    if (otpCode) {
      // This is OTP verification step - only for customer users
      if (user.userLevel !== "Customer") {
        return res.status(400).json({
          message: "OTP verification is only required for customer accounts",
        });
      }

      // Verify OTP
      const otpVerification = await OTPService.verifyOTP(
        user.userID,
        otpCode,
        browserId,
        "login"
      );

      if (!otpVerification.isValid) {
        return res.status(401).json({
          message: otpVerification.message,
          requiresOTP: true,
          email: user.email,
        });
      }

      // ✅ OTP VERIFIED - Complete login
      const sessionId = require("crypto").randomBytes(16).toString("hex");

      await user.update({
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAttempt: null,
        currentSessionId: sessionId,
        currentBrowserId: browserId,
        isLoggedIn: true,
        lastActivity: new Date(),
      });

      const token = jwt.sign(
        {
          userID: user.userID,
          userLevel: user.userLevel,
          sessionId: sessionId,
          browserId: browserId,
        },
        process.env.JWT_SECRET || "default-secret",
        { expiresIn: "24h" }
      );

      return res.status(200).json({
        message: "Login successful",
        token,
        user: {
          name: user.name,
          userLevel: user.userLevel,
          canOrder: user.userLevel === "Customer",
        },
        redirectUrl: "/index.html",
      });
    }

    // ✅ INITIAL LOGIN ATTEMPT (Password verification)
    if (!user.password) {
      return res.status(400).json({
        message:
          'This account uses Google Sign-In. Please use "Continue with Google".',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const updatedAttempts = user.loginAttempts + 1;

      if (updatedAttempts >= securityConfig.MAX_LOGIN_ATTEMPTS) {
        const lockedUntil = new Date(
          Date.now() + securityConfig.LOCKOUT_DURATION * 60000
        );

        let shouldArchive = false;
        if (
          securityConfig.AUTO_ARCHIVE_AFTER_LOCKOUT &&
          (user.userLevel === "Staff" || user.userLevel === "Admin")
        ) {
          shouldArchive = true;
        }

        await user.update({
          loginAttempts: updatedAttempts,
          lastLoginAttempt: new Date(),
          lockedUntil: lockedUntil,
          isArchived: shouldArchive ? true : user.isArchived,
        });

        const message = shouldArchive
          ? `Account locked and archived. Please contact administrator.`
          : `Account locked. Try again in ${securityConfig.LOCKOUT_DURATION} minutes.`;

        return res.status(423).json({ message });
      }

      await user.update({
        loginAttempts: updatedAttempts,
        lastLoginAttempt: new Date(),
      });

      const remainingAttempts =
        securityConfig.MAX_LOGIN_ATTEMPTS - updatedAttempts;
      return res.status(401).json({
        message: `Incorrect username or password. ${remainingAttempts} attempt(s) remaining.`,
      });
    }

    // ✅ PASSWORD VERIFIED - Check if OTP is required
    if (user.userLevel === "Customer") {
      // Send OTP for customer users
      try {
        await OTPService.createAndSendOTP(user, "login", browserId);

        return res.status(200).json({
          message: "OTP sent to your email",
          requiresOTP: true,
          email: user.email,
          userLevel: user.userLevel,
        });
      } catch (otpError) {
        console.error("Error sending OTP:", otpError);
        return res.status(500).json({
          message: "Failed to send OTP. Please try again.",
        });
      }
    }

    // ✅ DIRECT LOGIN FOR STAFF/ADMIN (No OTP required)
    const sessionId = require("crypto").randomBytes(16).toString("hex");

    await user.update({
      loginAttempts: 0,
      lockedUntil: null,
      lastLoginAttempt: null,
      currentSessionId: sessionId,
      currentBrowserId: browserId,
      isLoggedIn: true,
      lastActivity: new Date(),
    });

    const token = jwt.sign(
      {
        userID: user.userID,
        userLevel: user.userLevel,
        sessionId: sessionId,
        browserId: browserId,
      },
      process.env.JWT_SECRET || "default-secret",
      { expiresIn: "24h" }
    );

    let redirectUrl;
    if (user.userLevel === "Customer") {
      redirectUrl = "/index.html";
    } else if (user.userLevel === "Staff") {
      redirectUrl = "/staff/staff-dashboard.html";
    } else if (user.userLevel === "Admin") {
      redirectUrl = "/admin/admin-dashboard.html";
    }

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        userLevel: user.userLevel,
        canOrder: user.userLevel === "Customer",
      },
      redirectUrl,
    });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({
      message: "Server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Add OTP resend endpoint
router.post("/resend-otp", async (req, res) => {
  const { email, browserId } = req.body;

  if (!email || !browserId) {
    return res.status(400).json({
      message: "Email and browser ID are required",
    });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only allow OTP resend for customer users
    if (user.userLevel !== "Customer") {
      return res.status(400).json({
        message: "OTP is only required for customer accounts",
      });
    }

    await OTPService.createAndSendOTP(user, "login", browserId);

    res.status(200).json({
      message: "New OTP sent to your email",
      requiresOTP: true,
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({
      message: "Failed to resend OTP. Please try again.",
    });
  }
});

router.get("/check", verifyToken, validateSession, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userID);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ADD browser ID validation
    if (user.currentBrowserId !== req.user.browserId) {
      return res.status(401).json({
        message: "Session invalid. Please login again.",
      });
    }

    res.json({
      authenticated: true,
      user: {
        id: user.userID,
        name: user.name,
        email: user.email,
        userLevel: user.userLevel,
        canOrder: user.userLevel === "Customer",
      },
    });
  } catch (error) {
    console.error("Error checking auth:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Logout endpoint
router.post("/logout", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userID);
    if (user) {
      // Only clear if this is the correct browser
      if (user.currentBrowserId === req.user.browserId) {
        await user.update({
          currentSessionId: null,
          currentBrowserId: null,
          isLoggedIn: false,
          lastActivity: null,
        });
      }
    }

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
});

router.post("/signup-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res
          .status(400)
          .json({ message: "Email already registered and verified" });
      } else {
        const token = jwt.sign(
          { userID: existingUser.userID, email: existingUser.email },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );
        await existingUser.update({ verificationToken: token });
        await sendVerificationEmail(email, token);
        return res.status(200).json({ message: "Verification email resent" });
      }
    }

    const user = await User.create({
      email,
      isVerified: false,
      userLevel: "Customer",
    });
    const token = jwt.sign(
      { userID: user.userID, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    await user.update({ verificationToken: token });
    await sendVerificationEmail(email, token);

    res.status(200).json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Error in signup-email:", {
      message: error.message,
      stack: error.stack,
      email,
    });

    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.code === "ER_DUP_ENTRY"
    ) {
      return res.status(400).json({ message: "Email already registered" });
    }

    res.status(500).json({ message: `Server error: ${error.message}` });
  }
});

router.get("/verify", async (req, res) => {
  try {
    const token = req.query.token;
    console.log("Token received in /verify route:", token);

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }

    await user.update({ isVerified: true, verificationToken: null });

    const newToken = jwt.sign({ userID: user.userID }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    const redirectUrl = `${FRONTEND_URL}/customer/complete-registration.html?userID=${user.userID}&token=${newToken}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error("Error in verify:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//COMPLETE REGISTRATION ROUTE
router.post("/complete-registration", async (req, res) => {
  const { name, phone, address, password, secretQuestion, secretAnswer } =
    req.body;
  const token = req.query.token;

  console.log("Complete registration request body:", req.body);

  if (!name || !address || !password || !token) {
    return res
      .status(400)
      .json({ message: "Name, address, password, and token are required" });
  }

  if (phone && !/^(\+63|0)9\d{9}$/.test(phone)) {
    return res.status(400).json({
      message:
        "Please enter a valid Philippine phone number (e.g., +639171234567 or 09171234567)",
    });
  }

  // Validate secret question if provided
  if (secretQuestion && !secretAnswer) {
    return res.status(400).json({
      message: "Secret answer is required when setting a secret question",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);
    const user = await User.findByPk(decoded.userID);
    console.log("Found user:", user ? "Yes" : "No");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare update data
    const updateData = {
      name,
      phone: phone || null,
      address,
      password: hashedPassword,
    };

    // Add secret question data if provided
    if (secretQuestion && secretAnswer) {
      const hashedSecretAnswer = await bcrypt.hash(
        secretAnswer.toLowerCase().trim(),
        10
      );
      updateData.secretQuestion = secretQuestion;
      updateData.secretAnswer = hashedSecretAnswer;
      updateData.isSecretQuestionSet = true;
      updateData.lastSecretQuestionUpdate = new Date();
    }

    console.log("Updating user with:", updateData);
    await user.update(updateData);
    console.log("User updated successfully");

    res.status(200).json({
      message: "Registration completed successfully",
      secretQuestionSet: !!(secretQuestion && secretAnswer),
    });
  } catch (error) {
    console.error("Error in complete-registration:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/profile", verifyToken, setNoCacheHeaders, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userID);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      userLevel: user.userLevel,
      employeeID: user.employeeID,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//UPDATE PROFILE ROUTES
router.put(
  "/profile/update",
  verifyToken,
  allowCustomerOnly,
  setNoCacheHeaders,
  async (req, res) => {
    const { name, phone, address, secretQuestion, secretAnswer } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: "Name and address are required" });
    }

    // Validate secret question if provided
    if (secretQuestion && !secretAnswer) {
      return res.status(400).json({
        message: "Secret answer is required when updating secret question",
      });
    }

    try {
      const user = await User.findByPk(req.user.userID);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Prepare update data
      const updateData = {
        name,
        phone: phone || null,
        address,
      };

      // Add secret question data if provided
      if (secretQuestion && secretAnswer) {
        const hashedSecretAnswer = await bcrypt.hash(
          secretAnswer.toLowerCase().trim(),
          10
        );
        updateData.secretQuestion = secretQuestion;
        updateData.secretAnswer = hashedSecretAnswer;
        updateData.isSecretQuestionSet = true;
        updateData.lastSecretQuestionUpdate = new Date();
      }

      await user.update(updateData);

      res.status(200).json({
        message: "Profile updated successfully",
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        secretQuestionUpdated: !!(secretQuestion && secretAnswer),
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

//ADMIN AUTHENTICATION ROUTES
router.get("/users", verifyToken, setNoCacheHeaders, async (req, res) => {
  if (req.user.userLevel !== "Admin") {
    return res.status(403).json({ message: "Access denied: Admins only" });
  }

  try {
    const users = await User.findAll({
      where: { userLevel: ["Staff", "Admin"] },
      attributes: [
        "userID",
        "employeeID",
        "name",
        "email",
        "userLevel",
        "isArchived",
      ],
    });
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post(
  "/create-staff",
  verifyToken,
  setNoCacheHeaders,
  async (req, res) => {
    if (req.user.userLevel !== "Admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, password, and role are required" });
    }

    if (!["Staff", "Admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    try {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const staffCount = await User.count({
        where: {
          userLevel: ["Staff", "Admin"],
          employeeID: {
            [Sequelize.Op.ne]: null,
          },
        },
      });

      const newEmployeeID = `E${(staffCount + 1).toString().padStart(3, "0")}`;

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

      // Send email with credentials to the new user
      try {
        await sendStaffAccountEmail(email, name, password, role);
        console.log(`Account creation email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send account creation email:", emailError);
        // Don't fail the request if email fails, just log it
      }

      res.status(201).json({
        message: "Staff account created successfully",
        user: {
          employeeID: user.employeeID,
          name,
          email,
          role: user.userLevel,
        },
      });
    } catch (error) {
      console.error("Error creating staff account:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.put(
  "/users/:id/archive",
  verifyToken,
  setNoCacheHeaders,
  async (req, res) => {
    if (req.user.userLevel !== "Admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const { id } = req.params;
    const { isArchived } = req.body;

    try {
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If unarchiving, reset login attempts and remove lock so user can login again
      const updateData = { isArchived };
      if (!isArchived) {
        updateData.loginAttempts = 0;
        updateData.lastLoginAttempt = null;
        updateData.lockedUntil = null;
        updateData.archivedAt = null; // Clear archive date when unarchiving
      } else {
        // Set archive date when archiving
        updateData.archivedAt = new Date();
      }

      await user.update(updateData);
      res.status(200).json({
        message: `User ${isArchived ? "archived" : "unarchived"} successfully${
          !isArchived ? " and login security reset" : ""
        }`,
        archivedAt: isArchived ? updateData.archivedAt : null,
      });
    } catch (error) {
      console.error("Error updating archive status:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

router.post(
  "/auto-delete-archived",
  verifyToken,
  setNoCacheHeaders,
  async (req, res) => {
    if (req.user.userLevel !== "Admin") {
      return res.status(403).json({ message: "Access denied: Admins only" });
    }

    const { days = 30 } = req.body; // Default to 30 days if not specified

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Find users that are archived and were archived before the cutoff date
      const usersToDelete = await User.findAll({
        where: {
          isArchived: true,
          archivedAt: {
            [Op.lte]: cutoffDate,
          },
        },
      });

      const deletedUserIds = usersToDelete.map((user) => user.userID);

      // Delete the users
      await User.destroy({
        where: {
          isArchived: true,
          archivedAt: {
            [Op.lte]: cutoffDate,
          },
        },
      });

      res.status(200).json({
        success: true,
        deletedCount: usersToDelete.length,
        deletedUserIds: deletedUserIds,
        message: `Deleted ${usersToDelete.length} archived accounts older than ${days} days`,
      });
    } catch (error) {
      console.error("Error auto-deleting archived accounts:", error);
      res.status(500).json({ message: "Server error during auto-deletion" });
    }
  }
);

// endpoint to change password of staff/admin users
router.post("/change-password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userID;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({ password: hashedPassword });

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
