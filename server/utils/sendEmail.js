// Import nodemailer for sending emails
const nodemailer = require('nodemailer');
// Load environment variables from .env
require('dotenv').config();

// Define FRONTEND_URL based on environment
const FRONTEND_URL = process.env.NODE_ENV === 'production'
  ? (process.env.CLIENT_URL_PROD || 'https://slice-n-grind.onrender.com')
  : (process.env.CLIENT_URL_LOCAL || 'http://localhost:3000');

const BACKEND_URL = process.env.NODE_ENV === 'production'
  ? (process.env.BASE_URL_PROD || 'https://capstone-project-slisty.onrender.com')
  : (process.env.BASE_URL_LOCAL || 'http://localhost:3000');

console.log('FRONTEND_URL set to:', FRONTEND_URL);
console.log('BACKEND_URL set to:', BACKEND_URL);

// Configure Nodemailer transporter for Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Gmail address from .env
    pass: process.env.EMAIL_PASS, // Gmail app-specific password from .env
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

// Verify transporter connection
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('Gmail transporter ready');
    return true;
  } catch (error) {
    console.error('Gmail transporter verification failed:', error.message);
    console.log('Email functionality will use mock email fallback');
    return false;
  }
};

// Initialize connection verification (non-blocking)
verifyConnection().catch(console.error);

// Mock email function for when SMTP fails
const sendMockEmail = async (email, token, subject, html) => {
  const verificationUrl = subject.includes('Password Reset')
    ? `${FRONTEND_URL}/customer/reset-password.html?token=${token}&email=${email}`
    : `${BACKEND_URL}/api/auth/verify?token=${token}`;

  console.log('\n=== MOCK EMAIL (SMTP Failed) ===');
  console.log('To:', email);
  console.log('Subject:', subject);
  console.log('Verification Link:', verificationUrl);
  console.log('HTML Content:', html);
  console.log('*** COPY THIS LINK TO TEST EMAIL FUNCTIONALITY ***');
  console.log('=== END MOCK EMAIL ===\n');

  return true;
};

// Send email verification or password reset link
const sendVerificationEmail = async (email, token, subject = 'Verify Your Email - Slice N Grind', htmlContent) => {
  const defaultVerificationUrl = `${BACKEND_URL}/api/auth/verify?token=${token}`;
  const resetUrl = `${FRONTEND_URL}/customer/reset-password.html?token=${token}&email=${email}`;

  const mailOptions = {
    from: `"Slice N Grind" <${process.env.EMAIL_USER}>`,
    to: email,
    subject,
    html: htmlContent || `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Welcome to Slice N Grind!</h2>
        <p>Please verify your email by clicking the button below:</p>
        <a href="${defaultVerificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
        <p style="color: #5e5d5d;">This link expires in 1 hour.</p>
        <p style="color: #5e5d5d;">If you can't click the button, copy this link:</p>
        <p style="font-size: 12px; word-break: break-all;">${defaultVerificationUrl}</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
    `,
    text: `
      Welcome to Slice N Grind!
      
      Please ${subject.includes('Password Reset') ? 'reset your password' : 'verify your email'} by clicking this link: ${subject.includes('Password Reset') ? resetUrl : defaultVerificationUrl}
      
      This link expires in 1 hour.
      
      Best regards,
      Slice N Grind Team
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ ${subject} email sent successfully to ${email}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to send ${subject} email:`, {
      message: error.message,
      code: error.code,
      email
    });

    // Fall back to mock email in production or if transporter fails
    if (process.env.NODE_ENV === 'production' || !(await verifyConnection())) {
      console.log('Falling back to mock email');
      return await sendMockEmail(email, token, subject, mailOptions.html);
    }

    throw new Error(`Failed to send ${subject} email: ${error.message}`);
  }
};

// Send confirmation email for inquiry submission
const sendInquiryConfirmationEmail = async (email, name, subject, message) => {
  const mailOptions = {
    from: `"Slice N Grind" <${process.env.EMAIL_USER}>`,
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
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Confirmation email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('✗ Error sending confirmation email:', error.message);
    // Don't throw error for inquiry confirmations - not critical
    return false;
  }
};

// Send reply email to user for their inquiry
const sendInquiryReplyEmail = async (email, name, subject, reply) => {
  const mailOptions = {
    from: `"Slice N Grind" <${process.env.EMAIL_USER}>`,
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
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✓ Reply email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('✗ Error sending reply email:', error.message);
    // Don't throw error for inquiry replies - not critical
    return false;
  }
};

// Export email functions for use in routes
module.exports = { sendVerificationEmail, sendInquiryConfirmationEmail, sendInquiryReplyEmail, verifyConnection };
