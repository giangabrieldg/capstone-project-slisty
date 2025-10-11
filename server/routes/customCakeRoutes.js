/**
 * For handling custom cake order API endpoints
 * Supports creating, retrieving, and updating custom cake and image-based orders
 */
const express = require('express');
const router = express.Router();
const { CustomCakeOrder, ImageBasedOrder, User, Order, OrderItem, sequelize } = require('../models');
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

//Create a new custom cake order (3D design)
router.post('/create', verifyToken, upload.fields([
  { name: 'referenceImage', maxCount: 1 },
  { name: 'designImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const {
      size, cakeColor, icingStyle, icingColor, filling, bottomBorder, topBorder,
      bottomBorderColor, topBorderColor, decorations, flowerType, customText,
      messageChoice, toppingsColor, price, requiresReview = 'false',
      delivery_method = 'pickup',
      delivery_address = null,
      customer_name,
      customer_email, 
      customer_phone
    } = req.body;

    // Validate required fields
     if (!size || !cakeColor || !icingStyle || !icingColor || !filling || !bottomBorder ||
        !topBorder || !bottomBorderColor || !topBorderColor || !decorations ||
        !messageChoice || !toppingsColor || !customer_name || !customer_email || !customer_phone) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

     // Validate delivery method
    if (!['pickup', 'delivery'].includes(delivery_method)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery method' });
    }

    // Validate delivery address for delivery orders
    if (delivery_method === 'delivery' && !delivery_address) {
      return res.status(400).json({ success: false, message: 'Delivery address is required for delivery orders' });
    }

    // Determine if this requires admin review
    const needsReview = requiresReview === 'true';
    
    // ⭐ CRITICAL: If immediate checkout, price is REQUIRED
    if (!needsReview && (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid price is required for immediate checkout. Please ensure your profile is complete before ordering.' 
      });
    }

    let referenceImageUrl = null;
    let designImageUrl = null;

    // Upload reference image to Google Drive if provided
    if (req.files?.referenceImage) {
      referenceImageUrl = await googleDriveService.uploadImage(req.files.referenceImage[0]);
    }

    // Upload design image to Google Drive if provided
    if (req.files?.designImage) {
      designImageUrl = await googleDriveService.uploadImage(req.files.designImage[0]);
    }

    // Set status based on whether review is needed 
   let status;
   if (needsReview) {
    status = 'Pending Review';
   } else {
    // For immediate checkout with price, set to 'Ready for Downpayment'
    status = 'Ready for Downpayment';
   }

  const finalPrice = price ? parseFloat(price) : null;
  const downpaymentAmount = finalPrice ? finalPrice * 0.5 : null;
  const remainingBalance = finalPrice ? finalPrice * 0.5 : null

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
      price: finalPrice,
      status: status,
      payment_status: 'pending',
      downpayment_amount: downpaymentAmount,
      remaining_balance: remainingBalance,
      is_downpayment_paid: false,
      downpayment_paid_at: null,
      final_payment_status: 'pending',
      deliveryDate: req.body.deliveryDate || null,
      delivery_method,
      delivery_address: delivery_method === 'delivery' ? delivery_address : null,
      customer_name,
      customer_email,
      customer_phone
    });

   res.status(201).json({
   success: true,
   message: needsReview 
      ? 'Custom cake order created successfully and submitted for review' 
      : 'Custom cake order created successfully and ready for downpayment',
   customCakeId: customCakeOrder.customCakeId,
   status: customCakeOrder.status,
   requiresReview: needsReview
   });
  } catch (error) {
    console.error('Error creating custom cake order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


// POST /api/custom-cake/image-order - Create a new image-based order
router.post('/image-order', verifyToken, checkDriveAuth, upload.single('image'), async (req, res) => {
  try {
    const { flavor, message, notes, eventDate, size } = req.body;
    const delivery_method = req.body.delivery_method || 'pickup';
    const delivery_address = req.body.delivery_address || null;
    const customer_name = req.body.customer_name;
    const customer_email = req.body.customer_email;
    const customer_phone = req.body.customer_phone;

    // Validate required fields
     if (!flavor || !eventDate || !req.file || !customer_name || !customer_email || !customer_phone)  {
      return res.status(400).json({ success: false, message: 'Flavor, event date, image, and customer details are required' });
    }

     // Validate delivery method
    if (!['pickup', 'delivery'].includes(delivery_method)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery method' });
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

    // Create image-based order WITH SIZE
    const imageOrder = await ImageBasedOrder.create({
      userID: req.user.userID,
      imagePath: imageUrl,
      flavor,
      size: size || null, // ADD size
      message: message || null,
      notes: notes || null,
      eventDate,
      status: 'Pending Review',
      delivery_method,
      delivery_address: delivery_method === 'delivery' ? delivery_address : null,
      customer_name,
      customer_email,
      customer_phone
    });

    res.status(201).json({
      success: true,
      message: 'Image-based order created successfully',
      orderId: imageOrder.imageBasedOrderId, // Use correct ID field
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
      deliveryDate: order.deliveryDate,
      downpayment_amount: order.downpayment_amount,
      remaining_balance: order.remaining_balance,
      is_downpayment_paid: order.is_downpayment_paid,
      downpayment_paid_at: order.downpayment_paid_at,
      final_payment_status: order.final_payment_status,
      delivery_method: order.delivery_method,
      delivery_address: order.delivery_address,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone
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
      deliveryDate: order.deliveryDate,
      downpayment_amount: order.downpayment_amount,
      remaining_balance: order.remaining_balance,
      is_downpayment_paid: order.is_downpayment_paid,
      downpayment_paid_at: order.downpayment_paid_at,
      final_payment_status: order.final_payment_status,
      delivery_method: order.delivery_method,
      delivery_address: order.delivery_address,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone
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
      deliveryDate: order.deliveryDate
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
    // UPDATED: Add downpayment statuses to valid statuses
    if (!['Pending Review', 'Ready for Downpayment', 'Downpayment Paid', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled'].includes(status)) {
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
    // UPDATED: Add downpayment statuses to valid statuses
    if (!['Pending Review', 'Feasible', 'Ready for Downpayment', 'Downpayment Paid', 'In Progress', 'Ready for Pickup/Delivery', 'Completed', 'Cancelled', 'Not Feasible'].includes(status)) {
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

// PUT /api/custom-cake/admin/orders/:customCakeId/price - Set price for custom cake order
router.put('/admin/orders/:customCakeId/price', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }

    const { price, status, downpayment_amount, remaining_balance } = req.body;
    
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }

    const order = await CustomCakeOrder.findByPk(req.params.customCakeId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Custom cake order not found' });
    }

    const updateData = { 
      price: parseFloat(price),
      downpayment_amount: downpayment_amount || parseFloat(price) * 0.5,
      remaining_balance: remaining_balance || parseFloat(price) * 0.5,
      status: 'Ready for Downpayment' // ALWAYS set to ready for downpayment
    };

    await order.update(updateData);
    
    res.json({ 
      success: true, 
      message: 'Price set successfully', 
      order: {
        customCakeId: order.customCakeId,
        price: order.price,
        status: order.status,
        downpayment_amount: order.downpayment_amount,
        remaining_balance: order.remaining_balance
      }
    });
  } catch (error) {
    console.error('Error setting custom cake order price:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// PUT /api/custom-cake/admin/image-orders/:orderId/price - Set price for image-based order
router.put('/admin/image-orders/:orderId/price', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
    }

    const { price, status, downpayment_amount, remaining_balance } = req.body;
    
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({ success: false, message: 'Valid price is required' });
    }

    const order = await ImageBasedOrder.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Image-based order not found' });
    }

    const updateData = { 
      price: parseFloat(price),
      downpayment_amount: downpayment_amount || parseFloat(price) * 0.5,
      remaining_balance: remaining_balance || parseFloat(price) * 0.5,
      status: 'Ready for Downpayment' // ALWAYS set to ready for downpayment
    };

    await order.update(updateData);
    
    res.json({ 
      success: true, 
      message: 'Price set successfully and marked as ready for downpayment', 
      order: {
        id: order.id,
        price: order.price,
        status: order.status,
        downpayment_amount: order.downpayment_amount,
        remaining_balance: order.remaining_balance
      }
    });
  } catch (error) {
    console.error('Error setting image-based order price:', error);
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

router.post('/process-cash-payment', verifyToken, async (req, res) => {
  try {
    const { customCakeId, isImageOrder, pickupDate, totalAmount, isDownpayment } = req.body;

    console.log('Cash payment request:', { customCakeId, isImageOrder, isDownpayment, totalAmount });

 
    if (isDownpayment === true || isDownpayment === 'true') {
      console.warn(`SECURITY: Attempted cash downpayment for order ${customCakeId}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Downpayments must be paid using GCash. Cash payment is not allowed for downpayments.',
        reason: 'INVALID_DOWNPAYMENT_METHOD'
      });
    }

    // Get the order
    const OrderModel = isImageOrder ? ImageBasedOrder : CustomCakeOrder;
    const order = await OrderModel.findByPk(customCakeId);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify ownership
    if (order.userID !== req.user.userID) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const downpaymentStatuses = ['Ready for Downpayment', 'Downpayment Paid'];
    if (downpaymentStatuses.includes(order.status)) {
      console.warn(`SECURITY: Attempted cash payment on downpayment order ${customCakeId}, status: ${order.status}`);
      return res.status(400).json({ 
        success: false, 
        message: 'This order requires GCash payment for downpayment. Cash payment is not available for this order.',
        reason: 'ORDER_REQUIRES_DOWNPAYMENT'
      });
    }

    // Update order status
    await order.update({
      status: 'Ready for Pickup/Delivery',
      payment_status: 'pending', // Will be paid at pickup/delivery
      updatedAt: new Date()
    });

    res.json({ 
      success: true, 
      message: 'Order confirmed for cash payment at pickup/delivery',
      orderId: customCakeId
    });

  } catch (error) {
    console.error('Error processing cash payment:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});


module.exports = router;