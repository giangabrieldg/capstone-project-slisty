const { google } = require("googleapis");
require("dotenv").config();

const FRONTEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL_PROD || "https://slice-n-grind.onrender.com"
    : process.env.CLIENT_URL_LOCAL || "http://localhost:3000";

const BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? process.env.BASE_URL_PROD ||
      "https://capstone-project-slisty.onrender.com"
    : process.env.BASE_URL_LOCAL || "http://localhost:3000";

console.log("Email service configured for:", process.env.NODE_ENV);
console.log("Frontend URL:", FRONTEND_URL);
console.log("Backend URL:", BACKEND_URL);

// OAuth2 Client Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback"
);

if (process.env.GOOGLE_REFRESH_TOKEN) {
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
}

//Create base64 encoded email for Gmail API

const createEmailMessage = (to, subject, htmlContent) => {
  const emailLines = [
    `From: "Slice N Grind" <${process.env.EMAIL_USER}>`,
    `To: ${to}`,
    "Content-Type: text/html; charset=utf-8",
    "MIME-Version: 1.0",
    `Subject: ${subject}`,
    "",
    htmlContent,
  ];

  const message = emailLines.join("\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

//Send email via Gmail API

const sendEmailViaGmailAPI = async (to, subject, htmlContent) => {
  try {
    // Get access token
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new Error("Failed to get access token");
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const encodedMessage = createEmailMessage(to, subject, htmlContent);

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log(`Email sent to ${to} | Message ID: ${response.data.id}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error(`Gmail API error for ${to}:`, error.message);
    throw error;
  }
};

//Verify Gmail API connection

const verifyConnection = async () => {
  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) return false;

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });

    console.log(`Gmail API connected as: ${profile.data.emailAddress}`);
    return true;
  } catch (error) {
    console.error("Gmail API connection failed:", error.message);
    return false;
  }
};

//Send verification email

const sendVerificationEmail = async (
  email,
  token,
  subject = "Verify Your Email - Slice N Grind",
  htmlContent
) => {
  const defaultVerificationUrl = `${BACKEND_URL}/api/auth/verify?token=${token}`;
  const resetUrl = `${FRONTEND_URL}/customer/reset-password.html?token=${token}&email=${email}`;
  const isPasswordReset = subject.includes("Password Reset");

  const html =
    htmlContent ||
    `
    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
      <h2 style="color: #2c9045;">${
        isPasswordReset ? "Password Reset Request" : "Welcome to Slice N Grind!"
      }</h2>
      <p>Please ${
        isPasswordReset ? "reset your password" : "verify your email"
      } by clicking the button below:</p>
      <a href="${isPasswordReset ? resetUrl : defaultVerificationUrl}" 
         style="display: inline-block; padding: 10px 20px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px;">
        ${isPasswordReset ? "Reset Password" : "Verify Email"}
      </a>
      <p style="color: #5e5d5d;">This link expires in 1 hour.</p>
      <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
    </div>
  `;

  try {
    await sendEmailViaGmailAPI(email, subject, html);
    console.log(`${subject} sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);

    // Log the link for manual testing
    console.log(
      "Manual test link:",
      isPasswordReset ? resetUrl : defaultVerificationUrl
    );
    return false;
  }
};

//Send inquiry confirmation email
const sendInquiryConfirmationEmail = async (email, name, subject, message) => {
  const html = `
    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
      <h2 style="color: #2c9045;">Thank You, ${name}!</h2>
      <p>We have received your inquiry and will get back to you soon.</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Message:</strong> ${message}</p>
      <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
    </div>
  `;

  try {
    await sendEmailViaGmailAPI(email, "Inquiry Received - Slice N Grind", html);
    console.log(`✓ Inquiry confirmation sent to ${email}`);
    return true;
  } catch (error) {
    console.error("✗ Error sending confirmation email:", error.message);
    return false;
  }
};

//Send inquiry reply email

const sendInquiryReplyEmail = async (email, name, subject, reply) => {
  const html = `
    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
      <h2 style="color: #2c9045;">Hello, ${name}!</h2>
      <p>Thank you for your inquiry. Here is our response:</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p><strong>Response:</strong> ${reply}</p>
      <p style="color: #5e5d5d;">If you have further questions, please reach out.</p>
      <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
    </div>
  `;

  try {
    await sendEmailViaGmailAPI(
      email,
      `Response to Your Inquiry: ${subject} - Slice N Grind`,
      html
    );
    console.log(`Inquiry reply sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Error sending reply email:", error.message);
    return false;
  }
};

// Send staff account creation email with password
const sendStaffAccountEmail = async (email, name, password, role) => {
  const html = `
    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
      <h2 style="color: #2c9045;">Welcome to Slice N Grind, ${name}!</h2>
      <p>Your ${role} account has been created successfully.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #2c9045; margin: 20px 0;">
        <h4 style="color: #2c9045; margin-top: 0;">Your Login Credentials:</h4>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Password:</strong> <code style="background-color: #e9ecef; padding: 4px 8px; border-radius: 3px; font-family: monospace;">${password}</code></p>
        <p><strong>Role:</strong> ${role}</p>
      </div>

      <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
        <h4 style="color: #856404; margin-top: 0;">Important Security Notes:</h4>
        <ul style="color: #856404;">
          <li>Please change your password after first login</li>
          <li>Keep your credentials secure and do not share them</li>
          <li>If you suspect any unauthorized access, contact administrator immediately</li>
        </ul>
      </div>

      <p>You can login to your account here:</p>
      <a href="${FRONTEND_URL}/customer/login.html" 
         style="display: inline-block; padding: 12px 24px; background-color: #2c9045; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
        Login to Your Account
      </a>
      
      <p style="color: #5e5d5d; margin-top: 30px;">Best regards,<br>Slice N Grind Team</p>
    </div>
  `;

  try {
    await sendEmailViaGmailAPI(
      email,
      `Your ${role} Account Credentials - Slice N Grind`,
      html
    );
    console.log(`Staff account credentials sent to ${email}`);
    return true;
  } catch (error) {
    console.error(
      `Failed to send staff account email to ${email}:`,
      error.message
    );
    return false;
  }
};

// Send OTP email for login verification
const sendOTPEmail = async (email, otpCode, name) => {
  const html = `
    <div style="font-family: 'Poppins', sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #2c9045; border-radius: 8px;">
      <h2 style="color: #2c9045;">Login Verification Code - Slice N Grind</h2>
      <p>Hello ${name},</p>
      <p>Your One-Time Password (OTP) for login is:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <div style="display: inline-block; padding: 15px 30px; background-color: #f8f9fa; border: 2px dashed #2c9045; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2c9045;">
          ${otpCode}
        </div>
      </div>
      
      <p style="color: #5e5d5d; font-size: 14px;">
        <strong>Important:</strong> 
        <ul>
          <li>This code expires in 10 minutes</li>
          <li>Do not share this code with anyone</li>
          <li>If you didn't request this code, please ignore this email</li>
        </ul>
      </p>
      
      <p style="color: #5e5d5d;">Best regards,<br>Slice N Grind Team</p>
    </div>
  `;

  try {
    await sendEmailViaGmailAPI(
      email,
      "Your Login Verification Code - Slice N Grind",
      html
    );
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error(`Failed to send OTP email to ${email}:`, error.message);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendInquiryConfirmationEmail,
  sendInquiryReplyEmail,
  sendStaffAccountEmail,
  sendOTPEmail,
  verifyConnection,
};
