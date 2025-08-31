const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { Order, Cart, CartItem, MenuItem, ItemSize, OrderItem, User, CustomCakeOrder } = require('../models');
const verifyToken = require('../middleware/verifyToken');
const { Op } = require('sequelize');

// Middleware to check admin/staff permissions
const checkAdminOrStaff = (req, res, next) => {
  if (!['admin', 'staff'].includes(req.user.userLevel.toLowerCase())) {
    return res.status(403).json({ success: false, message: 'Unauthorized: Admin or staff access required' });
  }
  next();
};

// Helper function to create order items and update stock
const createOrderItems = async (orderId, items, transaction) => {
  await Promise.all(items.map(async (item) => {
    if (item.customCakeId) {
      const customCake = await CustomCakeOrder.findByPk(item.customCakeId, { transaction });
      if (!customCake) {
        throw new Error(`Custom cake order ${item.customCakeId} not found`);
      }
      if (customCake.status !== 'Feasible') {
        throw new Error(`Custom cake order ${item.customCakeId} is not Feasible`);
      }
      await OrderItem.create({
        orderId,
        customCakeId: item.customCakeId,
        quantity: item.quantity,
        price: item.price,
        item_name: item.name,
        size_name: item.size,
      }, { transaction });
    } else {
      await OrderItem.create({
        orderId,
        menuId: item.menuId,
        sizeId: item.sizeId,
        quantity: item.quantity,
        price: item.price,
        item_name: item.name,
        size_name: item.size,
      }, { transaction });

      const menuItem = await MenuItem.findByPk(item.menuId, {
        include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
        transaction,
      });

      if (!menuItem) {
        throw new Error(`Menu item ${item.menuId} not found`);
      }

      if (menuItem.hasSizes && item.size) {
        const validSize = menuItem.sizes.find(
          s => s.sizeName.trim().toLowerCase() === item.size.trim().toLowerCase()
        );
        if (!validSize) {
          throw new Error(`Invalid size ${item.size} for menu item ${item.menuId}`);
        }
        if (validSize.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.size} of ${item.name}`);
        }
        await validSize.update({ stock: validSize.stock - item.quantity }, { transaction });
      } else {
        if (menuItem.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.name}`);
        }
        await menuItem.update({ stock: menuItem.stock - item.quantity }, { transaction });
      }
    }
  }));
};

// Helper function to clear cart
const clearCart = async (userID, transaction) => {
  const cart = await Cart.findOne({ where: { userID }, transaction });
  if (cart) {
    await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
    console.log(`Cleared cart for user ${userID}`);
  }
};

// Helper function to format orders
const formatOrders = (orders) => {
  return orders.map(order => ({
    ...order.toJSON(),
    user: order.customer ? {
      userID: order.customer.userID,
      name: order.customer.name,
      email: order.customer.email,
    } : null,
    items: order.orderItems.map(item => ({
      menuId: item.menuId,
      customCakeId: item.customCakeId,
      name: item.customCakeId ? `Custom Cake (${item.CustomCakeOrder?.size})` : item.MenuItem?.name || item.item_name || 'Unknown',
      size: item.size_name || item.CustomCakeOrder?.size || null,
      price: item.price,
      quantity: item.quantity,
      image: item.CustomCakeOrder ? item.CustomCakeOrder.imageUrl : item.MenuItem?.image || null,
      customCakeDetails: item.CustomCakeOrder ? {
        size: item.CustomCakeOrder.size,
        cakeColor: item.CustomCakeOrder.cakeColor,
        icingStyle: item.CustomCakeOrder.icingStyle,
        icingColor: item.CustomCakeOrder.icingColor,
        filling: item.CustomCakeOrder.filling,
        bottomBorder: item.CustomCakeOrder.bottomBorder,
        topBorder: item.CustomCakeOrder.topBorder,
        bottomBorderColor: item.CustomCakeOrder.bottomBorderColor,
        topBorderColor: item.CustomCakeOrder.topBorderColor,
        decorations: item.CustomCakeOrder.decorations,
        flowerType: item.CustomCakeOrder.flowerType,
        customText: item.CustomCakeOrder.customText,
        messageChoice: item.CustomCakeOrder.messageChoice,
        toppingsColor: item.CustomCakeOrder.toppingsColor,
        imageUrl: item.CustomCakeOrder.imageUrl,
        status: item.CustomCakeOrder.status,
      } : null,
    })),
  }));
};

// POST /api/orders/create - Create new order
router.post('/create', verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { items, totalAmount, paymentMethod, deliveryMethod, pickupDate, customerInfo } = req.body;

    // Validate required fields
    if (!items || !totalAmount || !paymentMethod || !deliveryMethod || !customerInfo || !pickupDate) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Create order
    const order = await Order.create({
      userID: req.user.userID,
      total_amount: totalAmount,
      status: paymentMethod === 'gcash' ? 'pending_payment' : 'pending',
      payment_method: paymentMethod,
      payment_verified: paymentMethod === 'cash',
      delivery_method: deliveryMethod,
      pickup_date: pickupDate,
      customer_name: customerInfo.fullName,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      delivery_address: deliveryMethod === 'delivery' ? customerInfo.deliveryAddress : null,
      items: items,
    }, { transaction });

    // Create order items and reduce stock
    await createOrderItems(order.orderId, items, transaction);

    // Clear cart
    await clearCart(req.user.userID, transaction);

    await transaction.commit();
    res.json({
      success: true,
      message: 'Order created successfully',
      orderId: order.orderId,
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orders/verify-gcash-payment - Verify GCash payment and update order
router.post('/verify-gcash-payment', verifyToken, async (req, res) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { paymentId, orderData } = req.body;
    let order = await Order.findOne({
      where: { payment_id: paymentId },
      transaction,
    });

    if (!order) {
      order = await Order.create({
        userID: req.user.userID,
        total_amount: orderData.totalAmount,
        status: 'processing',
        payment_method: 'gcash',
        payment_verified: true,
        payment_id: paymentId,
        delivery_method: orderData.deliveryMethod,
        pickup_date: orderData.pickupDate,
        customer_name: orderData.customerInfo.fullName,
        customer_email: orderData.customerInfo.email,
        customer_phone: orderData.customerInfo.phone,
        delivery_address: orderData.deliveryMethod === 'delivery' ? orderData.customerInfo.deliveryAddress : null,
        items: orderData.items,
      }, { transaction });

      await createOrderItems(order.orderId, orderData.items, transaction);
      await clearCart(req.user.userID, transaction);
    } else if (order.status === 'pending_payment') {
      await order.update({
        status: 'processing',
        payment_verified: true,
        pickup_date: orderData.pickupDate,
      }, { transaction });

      await Promise.all(orderData.items.map(async (item) => {
        const existingOrderItem = await OrderItem.findOne({
          where: { orderId: order.orderId, menuId: item.menuId, size_name: item.size, customCakeId: item.customCakeId || null },
          transaction,
        });
        if (!existingOrderItem) {
          await OrderItem.create({
            orderId: order.orderId,
            customCakeId: item.customCakeId,
            menuId: item.menuId,
            sizeId: item.sizeId,
            quantity: item.quantity,
            price: item.price,
            item_name: item.name,
            size_name: item.size,
          }, { transaction });

          if (!item.customCakeId) {
            const menuItem = await MenuItem.findByPk(item.menuId, {
              include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
              transaction,
            });

            if (!menuItem) {
              throw new Error(`Menu item ${item.menuId} not found`);
            }

            if (menuItem.hasSizes && item.size) {
              const validSize = menuItem.sizes.find(
                s => s.sizeName.trim().toLowerCase() === item.size.trim().toLowerCase()
              );
              if (!validSize) {
                throw new Error(`Invalid size ${item.size} for menu item ${item.menuId}`);
              }
              if (validSize.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.size} of ${item.name}`);
              }
              await validSize.update({ stock: validSize.stock - item.quantity }, { transaction });
            } else {
              if (menuItem.stock < item.quantity) {
                throw new Error(`Insufficient stock for ${item.name}`);
              }
              await menuItem.update({ stock: menuItem.stock - item.quantity }, { transaction });
            }
          }
        }
      }));

      await clearCart(req.user.userID, transaction);
    }

    await transaction.commit();
    return res.json({ success: true, order });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('GCash verification failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/orders/user/me - Get user orders with order items
router.get('/user/me', verifyToken, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userID: req.user.userID },
      order: [['createdAt', 'DESC']],
      include: [{
        model: OrderItem,
        as: 'orderItems',
        include: [
          { model: MenuItem, attributes: ['name'] },
          { model: ItemSize, attributes: ['sizeName'] },
          { model: CustomCakeOrder, attributes: ['size', 'cakeColor', 'icingStyle', 'icingColor', 'filling', 'bottomBorder', 'topBorder', 'bottomBorderColor', 'topBorderColor', 'decorations', 'flowerType', 'customText', 'messageChoice', 'toppingsColor', 'imageUrl', 'status'] },
        ],
      }],
    });

    res.json({ success: true, orders: formatOrders(orders) });
  } catch (error) {
    console.error('Error in /user/me:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// GET /api/orders/:orderId - Get single order with details
router.get('/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { orderId: req.params.orderId, userID: req.user.userID },
      include: [{
        model: OrderItem,
        as: 'orderItems',
        include: [
          { model: MenuItem },
          { model: ItemSize },
          { model: CustomCakeOrder },
        ],
      }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Error fetching order' });
  }
});

// PUT /api/orders/:orderId/status - Update order status and payment verification
router.put('/:orderId/status', verifyToken, async (req, res) => {
  try {
    const { status, paymentId, payment_verified } = req.body;
    const order = await Order.findOne({
      where: { orderId: req.params.orderId, userID: req.user.userID },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    if (paymentId) order.payment_id = paymentId;
    if (payment_verified !== undefined) order.payment_verified = payment_verified;
    await order.save();

    res.json({ success: true, message: 'Order status updated', order });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ success: false, message: 'Error updating order' });
  }
});

// POST /api/orders/cancel/:orderId - Cancel an order
router.post('/cancel/:orderId', verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { orderId: req.params.orderId, userID: req.user.userID },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'pending_payment') {
      await order.update({ status: 'cancelled' });
      await OrderItem.destroy({ where: { orderId: order.orderId } });
      return res.json({ success: true, message: 'Order canceled' });
    }

    res.json({ success: true, message: 'No action needed', status: order.status });
  } catch (error) {
    console.error('Error canceling order:', error);
    res.status(500).json({ success: false, message: 'Error canceling order' });
  }
});

// GET /api/orders/admin/orders - Get all orders (admin and staff only)
router.get('/admin/orders', verifyToken, checkAdminOrStaff, async (req, res) => {
  try {
    const { pickup_date } = req.query;
    const where = pickup_date ? { pickup_date } : {};

    const orders = await Order.findAll({
      where,
      include: [
        { model: User, as: 'customer', attributes: ['userID', 'name', 'email'] },
        {
          model: OrderItem,
          as: 'orderItems',
          include: [
            { model: MenuItem, attributes: ['name', 'image'] },
            { model: ItemSize, attributes: ['sizeName', 'price'] },
            { model: CustomCakeOrder, attributes: ['size', 'cakeColor', 'icingStyle', 'icingColor', 'filling', 'bottomBorder', 'topBorder', 'bottomBorderColor', 'topBorderColor', 'decorations', 'flowerType', 'customText', 'messageChoice', 'toppingsColor', 'imageUrl', 'status'] },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, orders: formatOrders(orders) });
  } catch (error) {
    console.error('Admin orders error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/orders/admin/reports - Get sales reports data for admin dashboard
router.get('/admin/reports', verifyToken, checkAdminOrStaff, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Get orders with their items
    const orders = await Order.findAll({
      where: {
        createdAt: { [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')] }
      },
      include: [{
        model: OrderItem,
        as: 'orderItems',
        include: [
          { model: MenuItem, attributes: ['name'] },
          { model: CustomCakeOrder, attributes: ['size'] }
        ]
      }],
      order: [['createdAt', 'DESC']]
    });

    // Format order ID with leading zeros (ORD001, ORD012, etc.)
    function formatOrderId(orderId) {
        return 'ORD' + orderId.toString().padStart(3, '0');
    }

    // Format orders for response
    const formattedOrders = orders.map(order => ({
        orderId: formatOrderId(order.orderId),  // Use the formatted order ID
        customer_name: order.customer_name,
        total_amount: parseFloat(order.total_amount) || 0,
        status: order.status,
        order_date: order.createdAt,
        pickup_date: order.pickup_date || null,
        payment_method: order.payment_method || 'unknown',
        delivery_method: order.delivery_method || 'unknown',
        items: order.orderItems.map(item => ({
            name: item.customCakeId ? `Custom Cake (${item.CustomCakeOrder?.size})` : item.MenuItem?.name || item.item_name,
            size: item.size_name || item.CustomCakeOrder?.size || null,
            quantity: parseInt(item.quantity) || 0,
            price: parseFloat(item.price) || 0,
            customCakeId: item.customCakeId
        }))
    }));

    // Get daily orders count for chart
    const dailyOrders = await Order.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('orderId')), 'count']
      ],
      where: {
        createdAt: { [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')] }
      },
      group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
      order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
    });

    // Get popular items from order items
    const allOrderItems = await OrderItem.findAll({
      where: {
        createdAt: { [Op.between]: [new Date(startDate), new Date(endDate + ' 23:59:59')] }
      }
    });

    const itemCounts = {};
    allOrderItems.forEach(item => {
      const itemName = item.item_name || 'Unknown Item';
      itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
    });

    const popularItems = Object.entries(itemCounts)
      .map(([item_name, total_quantity]) => ({ item_name, total_quantity }))
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 10);

    // Calculate summary
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
    const customCakeOrders = orders.filter(order => 
      order.orderItems.some(item => item.customCakeId)
    ).length;

    res.json({
      success: true,
      orders: formattedOrders,
      daily_orders: dailyOrders,
      popular_items: popularItems,
      summary: {
        total_orders: orders.length,
        total_revenue: totalRevenue,
        custom_cake_orders: customCakeOrders,
        average_order_value: orders.length ? totalRevenue / orders.length : 0
      },
      date_range: { start_date: startDate, end_date: endDate }
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/orders/admin/orders/:orderId - Update order status (admin and staff only)
router.put('/admin/orders/:orderId', verifyToken, checkAdminOrStaff, async (req, res) => {
  const { status } = req.body;
  try {
    if (!['pending', 'pending_payment', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const order = await Order.findByPk(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    await order.update({ status });
    res.json({ success: true, message: 'Order status updated', order });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;