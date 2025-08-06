/**
 * Order Routes for Checkout Process
 * Handles order creation for both cash and GCash payments
 */

const express = require('express');
const router = express.Router();
const { Order, Cart, CartItem } = require('../models');
const verifyToken = require('../middleware/verifyToken');

/**
 * Create a new order
 * POST /api/orders/create
 * Creates order with items from cart
 */
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { items, totalAmount, paymentMethod, deliveryMethod, customerInfo } = req.body;

        // Validate required fields
        if (!items || !items.length || !totalAmount || !paymentMethod || !deliveryMethod || !customerInfo) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create order items array
        const orderItems = items.map(item => ({
            menuId: item.menuId,
            name: item.name,
            size: item.size,
            quantity: item.quantity,
            price: item.price,
            subtotal: item.price * item.quantity
        }));

        // Create order
        const order = await Order.create({
            total_amount: totalAmount,
            status: paymentMethod === 'gcash' ? 'pending_payment' : 'pending',
            payment_id: null,
            items: orderItems,
            delivery_method: deliveryMethod,
            customer_name: customerInfo.fullName,
            customer_email: customerInfo.email,
            customer_phone: customerInfo.phone,
            delivery_address: customerInfo.deliveryAddress || null,
            payment_method: paymentMethod
        });

        // Clear user's cart after successful order creation
        const cart = await Cart.findOne({ where: { userID: req.user.userID } });
        if (cart) {
            await CartItem.destroy({ where: { cartId: cart.cartId } });
        }

        res.json({
            success: true,
            message: 'Order created successfully',
            orderId: order.orderId,
            order
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: error.message
        });
    }
});

/**
 * Get order details
 * GET /api/orders/:orderId
 */
router.get('/:orderId', verifyToken, async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.orderId);
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order'
        });
    }
});

/**
 * Update order status
 * PUT /api/orders/:orderId/status
 */
router.put('/:orderId/status', verifyToken, async (req, res) => {
    try {
        const { status, paymentId } = req.body;
        
        const order = await Order.findByPk(req.params.orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        order.status = status;
        if (paymentId) order.payment_id = paymentId;
        
        await order.save();

        res.json({
            success: true,
            message: 'Order status updated',
            order
        });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating order'
        });
    }
});

/**
 * Get user's orders
 * GET /api/orders/user/me
 */
router.get('/user/me', verifyToken, async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { customer_email: req.user.email }, // Assuming email is used to identify customer
            order: [['createdAt', 'DESC']]
        });

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching orders'
        });
    }
});

module.exports = router;
