// Import required dependencies
     const express = require('express');
     const router = express.Router();
     const Inquiry = require('../models/inquiry-model');
     const User = require('../models/user-model');
     const verifyToken = require('../middleware/verifyToken');
     const { sendInquiryConfirmationEmail, sendInquiryReplyEmail } = require('../utils/sendEmail');
     require('dotenv').config();

     // Debug: Log native fetch to verify availability
     console.log('Native fetch available:', typeof fetch);

     // Middleware to restrict routes to Admin or Staff users
     const restrictToAdminStaff = (req, res, next) => {
       if (!['Admin', 'Staff'].includes(req.user.userLevel)) {
         return res.status(403).json({ error: 'Access restricted to Admin or Staff' });
       }
       next();
     };

     // Function to validate reCAPTCHA token with Google API using native fetch
     const validateRecaptcha = async (recaptchaToken) => {
       const secretKey = process.env.RECAPTCHA_SECRET_KEY;
       if (!secretKey) {
         console.error('Error: RECAPTCHA_SECRET_KEY is not set in .env');
         return false;
       }
       console.log('Using native fetch function:', typeof fetch); // Debug fetch
       try {
         const response = await fetch(`https://www.google.com/recaptcha/api/siteverify`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
           body: `secret=${secretKey}&response=${recaptchaToken}`,
         });
         const data = await response.json();
         console.log('reCAPTCHA validation response:', data);
         return data.success;
       } catch (error) {
         console.error('reCAPTCHA validation error:', error);
         return false;
       }
     };

// POST /api/inquiries: Submit a new inquiry (open to all users, logged-in or guest)
router.post('/', async (req, res) => {
  // Extract form data and reCAPTCHA token from request body
  const { name, email, phone, subject, message, recaptchaToken } = req.body;
  
  // Validate that all required fields are provided
  if (!name || !email || !phone || !subject || !message || !recaptchaToken) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Verify reCAPTCHA token
    const isRecaptchaValid = await validateRecaptcha(recaptchaToken);
    if (!isRecaptchaValid) {
      return res.status(401).json({ error: 'reCAPTCHA verification failed' });
    }

    // Check if user is logged in by validating JWT token
    let userID = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userID);
        if (user) userID = decoded.userID; // Set userID for logged-in users
      } catch (error) {
        // Invalid token, proceed as guest
      }
    }

    // Create new inquiry in the database
    const inquiry = await Inquiry.create({
      userID,
      name,
      email,
      phone,
      subject,
      message,
    });

    // Send confirmation email to the user
    await sendInquiryConfirmationEmail(email, name, subject, message);

    // Respond with success message
    res.status(201).json({ message: 'Inquiry submitted successfully' });
  } catch (error) {
    console.error('Error submitting inquiry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/inquiries: Fetch all inquiries (Admin/Staff only)
router.get('/', verifyToken, restrictToAdminStaff, async (req, res) => {
  try {
    // Retrieve all inquiries with associated user data, sorted by creation date
    const inquiries = await Inquiry.findAll({
      include: [{ model: User, attributes: ['name', 'email'] }],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json(inquiries); // Return inquiries as JSON
  } catch (error) {
    console.error('Error fetching inquiries:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inquiries/reply: Send a reply to an inquiry (Admin/Staff only)
router.post('/reply', verifyToken, restrictToAdminStaff, async (req, res) => {
  // Extract inquiry ID and reply text from request body
  const { inquiryId, reply } = req.body;
  
  // Validate required fields
  if (!inquiryId || !reply) {
    return res.status(400).json({ error: 'Inquiry ID and reply are required' });
  }

  try {
    // Find the inquiry by ID
    const inquiry = await Inquiry.findByPk(inquiryId);
    if (!inquiry) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    // Update inquiry with reply and status
    await inquiry.update({
      reply,
      status: 'Replied',
      repliedAt: new Date(),
    });

    // Send reply email to the user
    await sendInquiryReplyEmail(inquiry.email, inquiry.name, inquiry.subject, reply);

    // Respond with success message
    res.status(200).json({ message: 'Reply sent successfully' });
  } catch (error) {
    console.error('Error replying to inquiry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export the router for use in server/index.js
module.exports = router;