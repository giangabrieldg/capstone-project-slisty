const nodemailer = require('nodemailer');
require('dotenv').config();

// Enhanced transporter configuration for production with fallback options
const createTransporter = () => {
  // Try different SMTP configurations
  const configs = [
    {
      // Primary config - Gmail SMTP with SSL
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // Use SSL
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 20000, // Increased timeout
      greetingTimeout: 20000,
      socketTimeout: 20000,
    },
    {
      // Fallback config - Gmail SMTP with TLS
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
      requireTLS: true,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    }
  ];

  // Use the first config for production, second for development issues
  const config = process.env.NODE_ENV === 'production' ? configs[0] : configs[1];
  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

// Verify connection on startup with retry logic
const verifyConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await transporter.verify();
      console.log('Email transporter ready');
      return true;
    } catch (error) {
      console.error(`Email transporter attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) {
        console.error('All email transporter attempts failed');
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Initialize connection verification
verifyConnection();

// Send email verification link to new users
const sendVerificationEmail = async (email, token) => {
  const backendUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.BASE_URL_PROD || 'https://capstone-project-slisty.onrender.com'
      : process.env.BASE_URL_LOCAL || 'http://localhost:3000';

  const verificationUrl = `${backendUrl}/api/auth/verify?token=${token}`;

  console.log('Sending email to:', email);
  console.log('Using backend URL:', backendUrl);

  const mailOptions = {
    from: `"Slice N Grind" <${process.env.EMAIL_USER}>`,
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
    const result = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}:`, result.messageId);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', {
      message: error.message,
      stack: error.stack,
      email,
      code: error.code
    });

    // Try to recreate transporter and retry once
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNECTION') {
      console.log('Attempting to retry with new transporter...');
      try {
        const newTransporter = nodemailer.createTransport(configs[1]);
        await newTransporter.sendMail(mailOptions);
        console.log(`Verification email sent to ${email} on retry`);
        return true;
      } catch (retryError) {
        console.error('Retry also failed:', retryError.message);
      }
    }

    throw new Error(`Failed to send verification email: ${error.message}`);
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    throw new Error('Failed to send confirmation email');
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
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reply email sent to ${email}`);
  } catch (error) {
    console.error('Error sending reply email:', error);
    throw new Error('Failed to send reply email');
  }
};

module.exports = { sendVerificationEmail, sendInquiryConfirmationEmail, sendInquiryReplyEmail };