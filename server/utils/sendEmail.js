// Import nodemailer for sending emails
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure nodemailer transporter for email service (e.g., Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Email from .env
    pass: process.env.EMAIL_PASS, // App password from .env
  },
});

// Function to send verification email
const sendVerificationEmail = async (email, token) => {
  // Create verification link with token
  const verificationUrl = `http://localhost:3000/api/auth/verify?token=${token}`;

  // Email content
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email - Slice N Grind',
    html: `
      <h2>Welcome to Slice N Grind!</h2>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationUrl}">Verify Email</a>
      <p>This link expires in 1 hour.</p>
    `,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send verification email');
  }
};

// Export the function
module.exports = { sendVerificationEmail };