const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { Order, Cart, CartItem, MenuItem, ItemSize, OrderItem } = require('../models');
const verifyToken = require('../middleware/verifyToken');

/**
 * Create new order
 * - Validates input data
 * - Creates order and order items
 * - Reduces stock for each item (MenuItem for non-sized, ItemSize for sized)
 * - Clears cart after successful creation
 */
router.post('/create', verifyToken, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { items, totalAmount, paymentMethod, deliveryMethod, pickupDate, customerInfo } = req.body;

        // Validation: Ensure all required fields are provided
        if (!items || !totalAmount || !paymentMethod || !deliveryMethod || !customerInfo || !pickupDate) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create order with appropriate initial status
        const order = await Order.create({
            userID: req.user.userID,
            total_amount: totalAmount,
            status: paymentMethod === 'gcash' ? 'pending_payment' : 'pending',
            payment_method: paymentMethod,
            payment_verified: paymentMethod === 'cash', // Cash payments are automatically verified
            delivery_method: deliveryMethod,
            pickup_date: pickupDate,
            customer_name: customerInfo.fullName,
            customer_email: customerInfo.email,
            customer_phone: customerInfo.phone,
            delivery_address: deliveryMethod === 'delivery' ? customerInfo.deliveryAddress : null,
            items: items
        }, { transaction });

        // Create order items and reduce stock
        await Promise.all(items.map(async (item) => {
            // Create order item
            await OrderItem.create({
                orderId: order.orderId,
                menuId: item.menuId,
                sizeId: item.sizeId,
                quantity: item.quantity,
                price: item.price,
                item_name: item.name,
                size_name: item.size
            }, { transaction });

            // Fetch menu item to check hasSizes
            const menuItem = await MenuItem.findByPk(item.menuId, {
                include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
                transaction
            });

            if (!menuItem) {
                throw new Error(`Menu item ${item.menuId} not found`);
            }

            // Reduce stock based on whether item has sizes
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
                // Decrease stock for the selected size
                await validSize.update({ stock: validSize.stock - item.quantity }, { transaction });
            } else {
                if (menuItem.stock < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.name}`);
                }
                // Decrease stock for non-sized item
                await menuItem.update({ stock: menuItem.stock - item.quantity }, { transaction });
            }
        }));

        // Clear cart
        const cart = await Cart.findOne({ where: { userID: req.user.userID }, transaction });
        if (cart) {
            await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
        }

        await transaction.commit();

        res.json({
            success: true,
            message: 'Order created successfully',
            orderId: order.orderId
        });

    } catch (error) {
        await transaction.rollback();
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});
/**
 * Verify GCash payment and update order
 * - Creates or updates order based on payment verification
 * - Clears cart after successful payment
 */
router.post('/verify-gcash-payment', verifyToken, async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction(); // Initialize transaction
        
        const { paymentId, orderData } = req.body;

        // 1. Check for existing order
        let order = await Order.findOne({
            where: { payment_id: paymentId },
            transaction
        });

        if (!order) {
            // Create new verified order
            order = await Order.create({
                userID: req.user.userID,
                total_amount: orderData.totalAmount,
                status: 'processing', // Direct to processing since payment is verified
                payment_method: 'gcash',
                payment_verified: true,
                payment_id: paymentId,
                delivery_method: orderData.deliveryMethod,
                pickup_date: orderData.pickupDate,
                customer_name: orderData.customerInfo.fullName,
                customer_email: orderData.customerInfo.email,
                customer_phone: orderData.customerInfo.phone,
                delivery_address: orderData.deliveryMethod === 'delivery' 
                    ? orderData.customerInfo.deliveryAddress 
                    : null,
                items: orderData.items
            }, { transaction });

            // Create order items and reduce stock
            await Promise.all(orderData.items.map(async (item) => {
                // Create order item
                await OrderItem.create({
                    orderId: order.orderId,
                    menuId: item.menuId,
                    sizeId: item.sizeId,
                    quantity: item.quantity,
                    price: item.price,
                    item_name: item.name,
                    size_name: item.size
                }, { transaction });

                // Fetch menu item to check hasSizes
                const menuItem = await MenuItem.findByPk(item.menuId, {
                    include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
                    transaction
                });

                if (!menuItem) {
                    throw new Error(`Menu item ${item.menuId} not found`);
                }

                // Reduce stock based on whether item has sizes
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
                    // Decrease stock for the selected size
                    await validSize.update({ stock: validSize.stock - item.quantity }, { transaction });
                } else {
                    if (menuItem.stock < item.quantity) {
                        throw new Error(`Insufficient stock for ${item.name}`);
                    }
                    // Decrease stock for non-sized item
                    await menuItem.update({ stock: menuItem.stock - item.quantity }, { transaction });
                }
            }));

            // Clear cart after order creation
            const cart = await Cart.findOne({ where: { userID: req.user.userID }, transaction });
            if (cart) {
                await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
                console.log(`Cleared cart for user ${req.user.userID}`);
            }
        } else if (order.status === 'pending_payment') {
            // Update existing pending order
            await order.update({
                status: 'processing',
                payment_verified: true,
                pickup_date: orderData.pickupDate // Update with selected date if provided
            }, { transaction });

            // Create order items and reduce stock
            await Promise.all(orderData.items.map(async (item) => {
                // Create order item (in case not already created)
                const existingOrderItem = await OrderItem.findOne({
                    where: { orderId: order.orderId, menuId: item.menuId, size_name: item.size },
                    transaction
                });
                if (!existingOrderItem) {
                    await OrderItem.create({
                        orderId: order.orderId,
                        menuId: item.menuId,
                        sizeId: item.sizeId,
                        quantity: item.quantity,
                        price: item.price,
                        item_name: item.name,
                        size_name: item.size
                    }, { transaction });
                }

                // Fetch menu item to check hasSizes
                const menuItem = await MenuItem.findByPk(item.menuId, {
                    include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
                    transaction
                });

                if (!menuItem) {
                    throw new Error(`Menu item ${item.menuId} not found`);
                }

                // Reduce stock based on whether item has sizes
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
                    // Decrease stock for the selected size
                    await validSize.update({ stock: validSize.stock - item.quantity }, { transaction });
                } else {
                    if (menuItem.stock < item.quantity) {
                        throw new Error(`Insufficient stock for ${item.name}`);
                    }
                    // Decrease stock for non-sized item
                    await menuItem.update({ stock: menuItem.stock - item.quantity }, { transaction });
                }
            }));

            // Clear cart after updating order
            const cart = await Cart.findOne({ where: { userID: req.user.userID }, transaction });
            if (cart) {
                await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
                console.log(`Cleared cart for user ${req.user.userID}`);
            }
        }

        await transaction.commit();
        return res.json({ success: true, order });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('GCash verification failed:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Payment verification failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
/**
 * Get user orders with order items
 */
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

/**
 * Get single order with details
 */
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

/**
 * Update order status and payment verification
 */
router.put('/:orderId/status', verifyToken, async (req, res) => {
    try {
        const { status, paymentId, payment_verified } = req.body;
        const order = await Order.findOne({
            where: { orderId: req.params.orderId, userID: req.user.userID }
        });

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        order.status = status;
        if (paymentId) order.payment_id = paymentId;
        if (payment_verified !== undefined) order.payment_verified = payment_verified; // Update payment_verified
        await order.save();

        res.json({ success: true, message: 'Order status updated', order });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ success: false, message: 'Error updating order' });
    }
});

/**
 * Cancel an order
 */
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