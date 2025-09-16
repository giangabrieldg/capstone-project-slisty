// Import nodemailer for sending emails
const nodemailer = require('nodemailer');
// Load environment variables from .env
require('dotenv').config();

// Configure Nodemailer transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Gmail address from .env
    pass: process.env.EMAIL_PASS, // Gmail app-specific password from .env
  },// Add these options
  tls: {
    rejectUnauthorized: false
  },
  secure: true,
  port: 465
});

// Send email verification link to new users
const sendVerificationEmail = async (email, token) => {
  // Determine the base URL based on environment
  const baseUrl = process.env.NODE_ENV === 'production'
    ? (process.env.CLIENT_URL_PROD || 'https://slice-n-grind.onrender.com')
    : (process.env.CLIENT_URL_LOCAL || 'http://localhost:3000');

  console.log('Email verification baseUrl:', baseUrl);
  console.log('Environment:', process.env.NODE_ENV);
console.log('Email user exists:', !!process.env.EMAIL_USER);
console.log('JWT secret exists:', !!process.env.JWT_SECRET);
  

  // Construct verification URL with token
  const verificationUrl = `${baseUrl}/api/auth/verify?token=${token}`;
  
  // Define email content with branded styling
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify Your Email - Slice N Grind',
    html: `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Welcome to Slice N Grind!</h2>
        <p>Please verify your email by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
        <p style="color: #5e5d5d;">This link expires in 1 hour.</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
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

// Send confirmation email for inquiry submission
const sendInquiryConfirmationEmail = async (email, name, subject, message) => {
  // Define confirmation email content with branded styling
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Inquiry Received - Slice N Grind',
    html: `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Thank You, ${name}!</h2>
        <p>We have received your inquiry and will get back to you soon.</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
    `,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw new Error('Failed to send confirmation email');
  }
};

// Send reply email to user for their inquiry
const sendInquiryReplyEmail = async (email, name, subject, reply) => {
  // Define reply email content with branded styling
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Response to Your Inquiry: ${subject} - Slice N Grind`,
    html: `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Hello, ${name}!</h2>
        <p>Thank you for your inquiry. Here is our response:</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Response:</strong> ${reply}</p>
        <p style="color: #5e5d5d;">If you have further questions, please reach out.</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
    `,
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Reply email sent to ${email}`);
  } catch (error) {
    console.error('Error sending reply email:', error);
    throw new Error('Failed to send reply email');
  }
};

// Export email functions for use in routes
module.exports = { sendVerificationEmail, sendInquiryConfirmationEmail, sendInquiryReplyEmail };