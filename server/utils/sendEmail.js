const nodemailer = require('nodemailer');
require('dotenv').config();

// SendGrid configuration (primary choice for production)
const createSendGridTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: 'apikey', // This is literally the string 'apikey'
      pass: process.env.SENDGRID_API_KEY,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
};

// Gmail fallback configuration
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });
};

// Choose transporter based on available environment variables
const createTransporter = () => {
  if (process.env.SENDGRID_API_KEY) {
    console.log('Using SendGrid transporter');
    return createSendGridTransporter();
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    console.log('Using Gmail transporter');
    return createGmailTransporter();
  } else {
    console.error('No email configuration found!');
    throw new Error('Missing email configuration. Please set SENDGRID_API_KEY or EMAIL_USER/EMAIL_PASS');
  }
};

let transporter;
try {
  transporter = createTransporter();
} catch (error) {
  console.error('Failed to create email transporter:', error.message);
}

// Get sender email based on configuration
const getSenderEmail = () => {
  if (process.env.SENDGRID_FROM_EMAIL) {
    return process.env.SENDGRID_FROM_EMAIL;
  }
  return process.env.EMAIL_USER || 'noreply@slicengrind.com';
};

// Verify connection with better error handling
const verifyConnection = async () => {
  if (!transporter) {
    console.log('No transporter available, skipping verification');
    return false;
  }

  try {
    await transporter.verify();
    console.log('Email transporter ready');
    return true;
  } catch (error) {
    console.error('Email transporter verification failed:', error.message);
    console.log('Email functionality will be limited');
    return false;
  }
};

// Initialize connection verification (non-blocking)
if (transporter) {
  verifyConnection().catch(console.error);
}

// Mock email function for when SMTP fails
const sendMockEmail = async (email, token) => {
  const backendUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.BASE_URL_PROD || 'https://capstone-project-slisty.onrender.com'
      : process.env.BASE_URL_LOCAL || 'http://localhost:3000';

  const verificationUrl = `${backendUrl}/api/auth/verify?token=${token}`;
  
  console.log('\n=== MOCK EMAIL (SMTP Failed) ===');
  console.log('To:', email);
  console.log('Subject: Verify Your Email - Slice N Grind');
  console.log('Verification Link:', verificationUrl);
  console.log('*** COPY THIS LINK TO VERIFY EMAIL ***');
  console.log('=== END MOCK EMAIL ===\n');
  
  return true;
};

// Send email verification link to new users
const sendVerificationEmail = async (email, token) => {
  const backendUrl =
    process.env.NODE_ENV === 'production'
      ? process.env.BASE_URL_PROD || 'https://capstone-project-slisty.onrender.com'
      : process.env.BASE_URL_LOCAL || 'http://localhost:3000';

  const verificationUrl = `${backendUrl}/api/auth/verify?token=${token}`;
  const senderEmail = getSenderEmail();

  console.log('Attempting to send verification email...');
  console.log('To:', email);
  console.log('From:', senderEmail);
  console.log('Backend URL:', backendUrl);

  const mailOptions = {
    from: `"Slice N Grind" <${senderEmail}>`,
    to: email,
    subject: 'Verify Your Email - Slice N Grind',
    html: `
      <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
        <h2 style="color: #2c9045;">Welcome to Slice N Grind!</h2>
        <p>Please verify your email by clicking the button below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
        <p style="color: #5e5d5d;">This link expires in 1 hour.</p>
        <p style="color: #5e5d5d;">If you can't click the button, copy this link:</p>
        <p style="font-size: 12px; word-break: break-all;">${verificationUrl}</p>
        <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
      </div>
    `,
    text: `
      Welcome to Slice N Grind!
      
      Please verify your email by clicking this link: ${verificationUrl}
      
      This link expires in 1 hour.
      
      Best regards,
      Slice N Grind Team
    `
  };

  // If no transporter is available, use mock email
  if (!transporter) {
    console.log('No email transporter available, using mock email');
    return await sendMockEmail(email, token);
  }

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log(`✓ Verification email sent successfully to ${email}`);
    console.log('Message ID:', result.messageId);
    return true;
  } catch (error) {
    console.error('✗ Failed to send verification email:', {
      message: error.message,
      code: error.code,
      email: email
    });

    // In production, fall back to mock email so user can still verify
    if (process.env.NODE_ENV === 'production') {
      console.log('Falling back to mock email for user verification');
      return await sendMockEmail(email, token);
    }

    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

// Send confirmation email for inquiry submission
const sendInquiryConfirmationEmail = async (email, name, subject, message) => {
  if (!transporter) {
    console.log('No email transporter available for inquiry confirmation');
    return;
  }

  const senderEmail = getSenderEmail();
  
  const mailOptions = {
    from: `"Slice N Grind" <${senderEmail}>`,
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
    console.log(`✓ Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('✗ Error sending confirmation email:', error.message);
    // Don't throw error for inquiry confirmations - not critical
  }
};

// Send reply email to user for their inquiry
const sendInquiryReplyEmail = async (email, name, subject, reply) => {
  if (!transporter) {
    console.log('No email transporter available for inquiry reply');
    return;
  }

  const senderEmail = getSenderEmail();
  
  const mailOptions = {
    from: `"Slice N Grind" <${senderEmail}>`,
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
    console.log(`✓ Reply email sent to ${email}`);
  } catch (error) {
    console.error('✗ Error sending reply email:', error.message);
    // Don't throw error for inquiry replies - not critical
  }
};

// Export functions
module.exports = { 
  sendVerificationEmail, 
  sendInquiryConfirmationEmail, 
  sendInquiryReplyEmail,
  verifyConnection // Export for testing
};