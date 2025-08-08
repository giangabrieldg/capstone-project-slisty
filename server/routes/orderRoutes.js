/**
 * Order Routes for Checkout Process
 * Handles order creation for both cash and GCash payments
 */
const express = require('express');
const router = express.Router();
const { Order, Cart, CartItem, MenuItem, ItemSize, OrderItem } = require('../models');
const verifyToken = require('../middleware/verifyToken');

// Create new order
// Update the POST /create endpoint to match your new model
router.post('/create', verifyToken, async (req, res) => {
    try {
        const { items, totalAmount, paymentMethod, deliveryMethod, customerInfo } = req.body;

        // Validate required fields
        if (!items || !totalAmount || !paymentMethod || !deliveryMethod || !customerInfo) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create order with new model structure
        const order = await Order.create({
            userID: req.user.userID,
            total_amount: totalAmount,
            status: paymentMethod === 'gcash' ? 'pending_payment' : 'pending',
            payment_method: paymentMethod,
            delivery_method: deliveryMethod,
            customer_name: customerInfo.fullName,
            customer_email: customerInfo.email,
            customer_phone: customerInfo.phone,
            delivery_address: deliveryMethod === 'delivery' ? customerInfo.deliveryAddress : null,
            items: items // Storing as JSON for quick access
        });

        // Create OrderItems records
        const orderItems = await Promise.all(items.map(item => 
            OrderItem.create({
                orderId: order.orderId,
                menuId: item.menuId,
                sizeId: item.sizeId,
                quantity: item.quantity,
                price: item.price,
                item_name: item.name,
                size_name: item.size
            })
        ));

        // Clear cart
        const cart = await Cart.findOne({ where: { userID: req.user.userID } });
        if (cart) {
            await CartItem.destroy({ where: { cartId: cart.cartId } });
        }

        res.json({
            success: true,
            message: 'Order created successfully',
            orderId: order.orderId,
            order,
            orderItems
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get user orders with order items
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
                    { model: ItemSize, attributes: ['sizeName'] }
                ]
            }]
        });

        // Ensure items is properly formatted
        const formattedOrders = orders.map(order => ({
            ...order.toJSON(),
            items: order.orderItems.map(item => ({
                name: item.MenuItem?.name || 'Unknown',
                size: item.ItemSize?.sizeName || null,
                quantity: item.quantity,
                price: item.price
            }))
        }));

        res.json({ 
            success: true,
            orders: formattedOrders
        });
        
    } catch (error) {
        console.error('Error in /user/me:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch orders',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get single order with details
router.get('/:orderId', verifyToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { orderId: req.params.orderId, userID: req.user.userID },
            include: [{
                model: OrderItem,
                as: 'orderItems',
                include: [
                    { model: MenuItem },
                    { model: ItemSize }
                ]
            }]
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
// Get single order (must belong to logged-in user)
router.get('/:orderId', verifyToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { orderId: req.params.orderId, userID: req.user.userID }
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

// Update order status
router.put('/:orderId/status', verifyToken, async (req, res) => {
    try {
        const { status, paymentId } = req.body;
        const order = await Order.findOne({
            where: { orderId: req.params.orderId, userID: req.user.userID }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = status;
        if (paymentId) order.payment_id = paymentId;
        await order.save();

        res.json({ success: true, message: 'Order status updated', order });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
});
// cancel an order
router.post('/cancel/:orderId', verifyToken, async (req, res) => {
    try {
        const order = await Order.findOne({
            where: { orderId: req.params.orderId, userID: req.user.userID }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'pending_payment') {
            await order.update({ status: 'canceled' });
            await OrderItem.destroy({ where: { orderId: order.orderId } });
            return res.json({ success: true, message: 'Order canceled' });
        }

        res.json({ success: true, message: 'No action needed', status: order.status });
    } catch (error) {
        console.error('Error canceling order:', error);
        res.status(500).json({ success: false, message: 'Error canceling order' });
    }
});

module.exports = router;
