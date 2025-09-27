/**
 * For handling custom cake order API endpoints
 * Supports creating, retrieving, and updating custom cake and image-based orders
 */
const express = require('express');
const router = express.Router();
const { CustomCakeOrder, ImageBasedOrder, User, sequelize } = require('../models');
const verifyToken = require('../middleware/verifyToken');
const checkDriveAuth = require('../middleware/driveAuth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const googleDriveService = require('../utils/googleDrive');

// Configure Multer for temporary file storage
const uploadDir = path.join(__dirname, '../../Uploads/custom-cakes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.memoryStorage();

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

// POST /api/custom-cake/create - Create a new custom cake order (3D design)
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

    let referenceImageUrl = null;
    let designImageUrl = null;

    // Upload reference image to Google Drive if provided
    if (req.files.referenceImage) {
      referenceImageUrl = await googleDriveService.uploadImage(req.files.referenceImage[0]);
    }

    // Upload design image to Google Drive if provided
    if (req.files.designImage) {
      designImageUrl = await googleDriveService.uploadImage(req.files.designImage[0]);
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
      referenceImageUrl,
      designImageUrl,
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
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/custom-cake/image-order - Create a new image-based order
router.post('/image-order', verifyToken, checkDriveAuth, upload.single('image'), async (req, res) => {
  try {
    const { flavor, message, notes, eventDate } = req.body;

    // Validate required fields
    if (!flavor || !eventDate || !req.file) {
      return res.status(400).json({ success: false, message: 'Flavor, event date, and image are required' });
    }

    // Validate event date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const selectedDate = new Date(eventDate);
    if (selectedDate < tomorrow) {
      return res.status(400).json({ success: false, message: 'Event date must be tomorrow or later' });
    }

    // Upload image to Google Drive
    const imageUrl = await googleDriveService.uploadImage(req.file);

    // Create image-based order
    const imageOrder = await ImageBasedOrder.create({
      userID: req.user.userID,
      imagePath: imageUrl,
      flavor,
      message: message || null,
      notes: notes || null,
      eventDate,
      status: 'Pending Review',
    });

    res.status(201).json({
      success: true,
      message: 'Image-based order created successfully',
      orderId: imageOrder.id,
    });
  } catch (error) {
    console.error('Error creating image-based order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/custom-cake/orders - Get user's custom cake orders
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const orders = await CustomCakeOrder.findAll({
      where: { userID: req.user.userID },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching custom cake orders:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/custom-cake/image-orders - Get user's image-based orders
router.get('/image-orders', verifyToken, async (req, res) => {
  try {
    const orders = await ImageBasedOrder.findAll({
      where: { userID: req.user.userID },
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, orders });
  } catch (error) {
    console.error('Error fetching image-based orders:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
          required: false,
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
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/custom-cake/admin/image-orders - Get all image-based orders (admin/staff only)
router.get('/admin/image-orders', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }

    const orders = await ImageBasedOrder.findAll({
      include: [
        {
          model: User,
          as: 'customer',
          attributes: ['userID', 'name', 'email'],
          required: false,
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
    console.error('Admin image-based orders error:', error);
    
    // Handle table doesn't exist error gracefully
    if (error.name === 'SequelizeDatabaseError' && error.message.includes('doesn\'t exist')) {
      console.warn('imagebasedorders table does not exist');
      return res.json({ success: true, orders: [], message: 'No image-based orders found' });
    }
    
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
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
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// PUT /api/custom-cake/image-orders/:orderId - Update image-based order status (admin/staff only)
router.put('/image-orders/:orderId', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }
    const { status } = req.body;
    if (!['Pending Review', 'Feasible', 'Not Feasible'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const order = await ImageBasedOrder.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Image-based order not found' });
    }
    await order.update({ status });
    res.json({ success: true, message: 'Image-based order status updated', order });
  } catch (error) {
    console.error('Error updating image-based order status:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/custom-cake/:customCakeId - Get custom cake order details
router.get('/:customCakeId', verifyToken, async (req, res) => {
  try {
    const order = await CustomCakeOrder.findByPk(req.params.customCakeId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Custom cake order not found' });
    }
    if (order.userID !== req.user.userID && !['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching custom cake order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// GET /api/custom-cake/image-orders/:orderId - Get image-based order details
router.get('/image-orders/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await ImageBasedOrder.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Image-based order not found' });
    }
    if (order.userID !== req.user.userID && !['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }
    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching image-based order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/custom-cake/:customCakeId - Delete custom cake order
router.delete('/:customCakeId', verifyToken, async (req, res) => {
  try {
    const order = await CustomCakeOrder.findByPk(req.params.customCakeId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Custom cake order not found' });
    }
    if (order.userID !== req.user.userID && !['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }
    // Delete associated Google Drive files
    if (order.referenceImageUrl) {
      await googleDriveService.deleteFile(order.referenceImageUrl);
    }
    if (order.designImageUrl) {
      await googleDriveService.deleteFile(order.designImageUrl);
    }
    await order.destroy();
    res.json({ success: true, message: 'Custom cake order deleted' });
  } catch (error) {
    console.error('Error deleting custom cake order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// DELETE /api/custom-cake/image-orders/:orderId - Delete image-based order
router.delete('/image-orders/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await ImageBasedOrder.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Image-based order not found' });
    }
    if (order.userID !== req.user.userID && !['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }
    // Delete associated Google Drive file
    if (order.imagePath) {
      await googleDriveService.deleteFile(order.imagePath);
    }
    await order.destroy();
    res.json({ success: true, message: 'Image-based order deleted' });
  } catch (error) {
    console.error('Error deleting image-based order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router;