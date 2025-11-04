// backend routes for forgot password
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/user-model");
const ResetToken = require("../models/reset-token-model");
const { sendVerificationEmail } = require("../utils/sendEmail");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Route to handle forgot password with email
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Incorrect username or password" });
    }

    if (user.isArchived) {
      return res.status(403).json({ message: "Account is archived" });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userID: user.userID },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Store reset token
    await ResetToken.create({
      userID: user.userID,
      token: resetToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiry
    });

    // Send reset email
    const emailSent = await sendVerificationEmail(
      email,
      resetToken,
      "Password Reset Request - Slice N Grind"
    );
    if (!emailSent) {
      throw new Error("Failed to send reset email");
    }

    console.log(`Password reset requested for ${email}`);
    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (error) {
    console.error("Error in forgot-password:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to handle forgot password with secret question (when email is forgotten)
router.post("/forgot-password-secret", async (req, res) => {
  const { email, secretAnswer } = req.body; // Changed from name to email

  if (!email || !secretAnswer) {
    return res
      .status(400)
      .json({ message: "Email and secret answer are required" });
  }

  try {
    // Find user by email instead of name
    const user = await User.findOne({
      where: {
        email,
        isSecretQuestionSet: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found or secret question not set",
      });
    }

    if (user.isArchived) {
      return res.status(403).json({ message: "Account is archived" });
    }

    // Verify secret answer (case-insensitive, trimmed)
    const normalizedAnswer = secretAnswer.toLowerCase().trim();
    const isAnswerCorrect = await bcrypt.compare(
      normalizedAnswer,
      user.secretAnswer
    );

    if (!isAnswerCorrect) {
      return res.status(401).json({ message: "Incorrect secret answer" });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userID: user.userID },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Store reset token
    await ResetToken.create({
      userID: user.userID,
      token: resetToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour expiry
    });

    // Return success with token for password reset
    res.status(200).json({
      message: "Secret answer verified successfully",
      token: resetToken,
      email: user.email, // Return email so user knows which account they're resetting
    });
  } catch (error) {
    console.error("Error in forgot-password-secret:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to get secret question for a user
router.post("/get-secret-question", async (req, res) => {
  const { email } = req.body; // Changed from name to email

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({
      where: { email },
      attributes: ["secretQuestion", "isSecretQuestionSet", "name"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isSecretQuestionSet) {
      return res
        .status(400)
        .json({ message: "Secret question not set for this user" });
    }

    res.status(200).json({
      secretQuestion: user.secretQuestion,
      userName: user.name, // Return name for confirmation
    });
  } catch (error) {
    console.error("Error in get-secret-question:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to set or update secret question
router.post("/set-secret-question", verifyToken, async (req, res) => {
  const { secretQuestion, secretAnswer } = req.body;

  if (!secretQuestion || !secretAnswer) {
    return res.status(400).json({
      message: "Secret question and answer are required",
    });
  }

  if (secretQuestion.length > 255 || secretAnswer.length > 255) {
    return res.status(400).json({
      message: "Question and answer must be less than 255 characters",
    });
  }

  try {
    const user = await User.findByPk(req.user.userID);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Hash the secret answer before storing
    const hashedAnswer = await bcrypt.hash(
      secretAnswer.toLowerCase().trim(),
      10
    );

    await user.update({
      secretQuestion,
      secretAnswer: hashedAnswer,
      isSecretQuestionSet: true,
      lastSecretQuestionUpdate: new Date(),
    });

    res.status(200).json({
      message: "Secret question set successfully",
    });
  } catch (error) {
    console.error("Error in set-secret-question:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to check if secret question is set
router.get("/check-secret-question", verifyToken, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.userID, {
      attributes: ["isSecretQuestionSet", "lastSecretQuestionUpdate"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      isSecretQuestionSet: user.isSecretQuestionSet,
      lastSecretQuestionUpdate: user.lastSecretQuestionUpdate,
    });
  } catch (error) {
    console.error("Error in check-secret-question:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to handle password reset - UPDATED TO HANDLE BOTH BODY AND QUERY PARAM
router.post("/reset-password", async (req, res) => {
  let { token, password } = req.body;

  // If token is not in body, check query parameters
  if (!token) {
    token = req.query.token;
  }

  if (!token || !password) {
    return res.status(400).json({ message: "Token and password are required" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = await ResetToken.findOne({
      where: { userID: user.userID, token },
    });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword });

    // Delete used token
    await ResetToken.destroy({ where: { userID: user.userID } });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset-password:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Alternative route that accepts token as URL parameter
router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userID);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetToken = await ResetToken.findOne({
      where: { userID: user.userID, token },
    });
    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword });

    // Delete used token
    await ResetToken.destroy({ where: { userID: user.userID } });

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error in reset-password:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
