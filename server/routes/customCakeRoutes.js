const express = require('express');
const router = express.Router();
const { CustomCakeOrder, User } = require('../models');
const verifyToken = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for image uploads
const uploadDir = path.join(__dirname, '../../Uploads/custom-cakes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    
    // Use the original filename but ensure it has the right extension
    const originalName = path.parse(file.originalname).name;
    const extension = path.extname(file.originalname);
    
    // Generate a simple filename without extra prefixes
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG/PNG images are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// POST /api/custom-cake/create - Create a new custom cake order
router.post('/create', verifyToken, upload.fields([
  { name: 'referenceImage', maxCount: 1 },
  { name: 'designImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      size, cakeColor, icingStyle, icingColor, filling, bottomBorder, topBorder,
      bottomBorderColor, topBorderColor, decorations, flowerType, customText,
      messageChoice, toppingsColor, price
    } = req.body;

    // Validate required fields
    if (!size || !cakeColor || !icingStyle || !icingColor || !filling || !bottomBorder ||
        !topBorder || !bottomBorderColor || !topBorderColor || !decorations ||
        !messageChoice || !toppingsColor || !price) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Create custom cake order
    const customCakeOrder = await CustomCakeOrder.create({
      userID: req.user.userID,
      size,
      cakeColor,
      icingStyle,
      icingColor,
      filling,
      bottomBorder,
      topBorder,
      bottomBorderColor,
      topBorderColor,
      decorations,
      flowerType: decorations === 'flowers' ? flowerType : 'none',
      customText: messageChoice === 'custom' ? customText : null,
      messageChoice,
      toppingsColor,
      referenceImageUrl: req.files.referenceImage ? `/Uploads/custom-cakes/${req.files.referenceImage[0].filename}` : null,
      designImageUrl: req.files.designImage ? `/Uploads/custom-cakes/${req.files.designImage[0].filename}` : null,
      price: parseFloat(price),
      status: 'Pending Review',
    });

    res.status(201).json({
      success: true,
      message: 'Custom cake order created successfully',
      customCakeId: customCakeOrder.customCakeId,
    });
  } catch (error) {
    console.error('Error creating custom cake order:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/custom-cake/user/me - Get user's custom cake orders
router.get('/user/me', verifyToken, async (req, res) => {
  try {
    const orders = await CustomCakeOrder.findAll({
      where: { userID: req.user.userID },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching custom cake orders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/custom-cake/admin/orders - Get all custom cake orders (admin/staff only)
router.get('/admin/orders', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }
    const orders = await CustomCakeOrder.findAll({
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['userID', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
    const formattedOrders = orders.map(order => ({
      ...order.toJSON(),
      customer: order.customer ? {
        userID: order.customer.userID,
        name: order.customer.name,
        email: order.customer.email,
      } : null,
    }));
    res.json({ success: true, orders: formattedOrders });
  } catch (error) {
    console.error('Admin custom cake orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/custom-cake/admin/orders/:customCakeId - Update custom cake order status (admin/staff only)
router.put('/admin/orders/:customCakeId', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }
    const { status } = req.body;
    if (!['Pending Review', 'Feasible', 'Not Feasible'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const order = await CustomCakeOrder.findByPk(req.params.customCakeId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Custom cake order not found' });
    }
    await order.update({ status });
    res.json({ success: true, message: 'Custom cake order status updated', order });
  } catch (error) {
    console.error('Error updating custom cake order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;