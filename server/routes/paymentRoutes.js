const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const { PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET } = process.env;
const { Order, OrderItem, Cart, CartItem, CustomCakeOrder, ImageBasedOrder } = require('../models');
const sequelize = require('../config/database');
const verifyToken = require('../middleware/verifyToken');

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature, payload, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return signature === hmac.digest('hex');
};

// POST /api/payment/create-gcash-source - Create a GCash payment source with Paymongo
router.post('/create-gcash-source', verifyToken, async (req, res) => {
    try {
        const { amount, description, items, redirect } = req.body;

        // Validate required fields
        if (!amount || !items || !redirect?.success || !redirect?.failed) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields (amount, items, redirect URLs)'
            });
        }

        // Validate amount is positive and meets minimum for GCash
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be greater than zero'
            });
        }
        if (amount < 2000) {
            return res.status(400).json({
                success: false,
                error: 'GCash payments require a minimum amount of Php 20.00'
            });
        }

        // Create Paymongo payment link
        const paymongoResponse = await axios.post(
            'https://api.paymongo.com/v1/links',
            {
                data: {
                    attributes: {
                        amount: Math.round(amount),
                        description: description || `Pending Order`,
                        remarks: `Pending Order for user ${req.user.userID}`,
                        currency: 'PHP',
                        checkout: {
                            name: req.user.name || 'Customer',
                            email: req.user.email
                        },
                        redirect: {
                            success: redirect.success,
                            failed: redirect.failed
                        },
                        payment_method_allowed: ['gcash'],
                        metadata: {
                            userId: req.user.userID,
                            items: items,
                            system: 'Slice N Grind'
                        }
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const paymentLink = paymongoResponse.data.data;
        const checkoutUrl = paymentLink.attributes.checkout_url;

        // Log the payment initiation
        console.log('Payment link created:', {
            paymentLinkId: paymentLink.id,
            amount: (amount/100).toFixed(2),
            checkoutUrl,
            userId: req.user.userID,
            createdAt: new Date().toISOString()
        });

        res.json({
            success: true,
            checkoutUrl,
            paymentId: paymentLink.id,
            sandboxNote: process.env.NODE_ENV === 'development' ?
                'Use test GCash number 9051111111 for successful payment' : undefined
        });

    } catch (error) {
        console.error('Paymongo GCash Error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            stack: error.stack
        });

        let statusCode = 500;
        let errorMessage = 'Payment processing failed';

        if (error.response) {
            statusCode = error.response.status || 500;
            errorMessage = error.response.data?.errors?.[0]?.detail || errorMessage;
        } else if (error.request) {
            errorMessage = 'No response from payment service';
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'Payment service timeout';
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ?
                (error.response?.data || error.message) : undefined
        });
    }
});

// POST /api/orders/verify-gcash-payment - Verify and create/update order after GCash payment
router.post('/verify-gcash-payment', verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { paymentId, orderData } = req.body;
    
    // Check if order already exists (created by webhook)
    let order = await Order.findOne({
      where: { payment_id: paymentId },
      include: [{
        model: OrderItem,
        as: 'orderItems'
      }],
      transaction
    });

    if (order) {
      // Order already created by webhook, just return it
      await transaction.commit();
      return res.json({
        success: true,
        order,
        message: 'Order already processed'
      });
    }

    // If webhook hasn't processed yet, create the order
    order = await Order.create({
      userID: req.user.userID,
      total_amount: orderData.totalAmount,
      status: 'processing',
      payment_id: paymentId,
      payment_verified: true,
      payment_method: 'gcash',
      delivery_method: orderData.deliveryMethod,
      customer_name: orderData.customerInfo.fullName,
      customer_email: orderData.customerInfo.email,
      customer_phone: orderData.customerInfo.phone,
      delivery_address: orderData.customerInfo.deliveryAddress,
      items: orderData.items
    }, { transaction });

    // Create order items
    if (orderData.items && orderData.items.length > 0) {
      await OrderItem.bulkCreate(
        orderData.items.map(item => ({
          orderId: order.orderId,
          menuId: item.menuId,
          sizeId: item.sizeId,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          size_name: item.size
        })),
        { transaction }
      );
    }

    // Clear the user's cart
    const cart = await Cart.findOne({ 
      where: { userID: req.user.userID },
      transaction
    });

    if (cart) {
      await CartItem.destroy({
        where: { cartId: cart.cartId },
        transaction
      });
    }

    await transaction.commit();
    
    res.json({
      success: true,
      order,
      message: 'Order created successfully'
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Order verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify order',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/payment/verify/:orderId - Verify payment status and update order if needed
router.get('/verify/:orderId', verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get the order with items
    const order = await Order.findOne({
      where: { 
        orderId,
        userID: req.user.userID 
      },
      include: [{
        model: OrderItem,
        as: 'orderItems'
      }]
    });

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
    }

    // For cash payments, just return current status
    if (order.payment_method === 'cash') {
      return res.json({
        success: true,
        status: order.status,
        isPaid: order.status === 'completed',
        order
      });
    }

    // For GCash payments, verify with Paymongo
    if (!order.payment_id) {
      return res.status(400).json({
        success: false,
        error: 'No payment associated with this order'
      });
    }

    const response = await axios.get(
      `https://api.paymongo.com/v1/links/${order.payment_id}`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`
        },
        timeout: 5000
      }
    );

    const paymentData = response.data.data;
    const paymentStatus = paymentData.attributes.status;
    const isPaid = paymentStatus === 'paid';

    // Validate currency
    if (paymentData.attributes.currency !== 'PHP') {
      throw new Error('Invalid currency');
    }

    // Update order status if paid and not yet verified
    if (isPaid && order.status === 'pending_payment') {
      await order.update({
        status: 'processing',
        payment_verified: true
      });
    }

    res.json({
      success: true,
      status: paymentStatus,
      isPaid,
      paidAt: paymentData.attributes.paid_at,
      amount: paymentData.attributes.amount / 100,
      currency: paymentData.attributes.currency,
      paymentMethod: paymentData.attributes.payments[0]?.source?.type || 'gcash',
      order
    });

  } catch (error) {
    console.error('Payment verification failed:', error);
    
    let statusCode = 500;
    let errorMessage = 'Payment verification failed';

    if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = 'Payment not found';
    }

    res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? 
        (error.response?.data?.errors || error.message) : undefined
    });
  }
});

// POST /api/payment/create-custom-cake-payment
router.post('/create-custom-cake-payment', verifyToken, async (req, res) => {
    try {
        const { customCakeId, isImageOrder, amount, description, redirect } = req.body;

        // Validate required fields
        if (!customCakeId || !amount || !redirect?.success || !redirect?.failed) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields (customCakeId, amount, redirect URLs)'
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Amount must be greater than zero'
            });
        }

        // Verify custom cake order exists and belongs to user
        let customOrder;
        if (isImageOrder) {
          customOrder = await ImageBasedOrder.findOne({
            where: { 
              id: customCakeId,
              userID: req.user.userID 
            }
          });
        } else {
          customOrder = await CustomCakeOrder.findOne({
            where: { 
              customCakeId: customCakeId,
              userID: req.user.userID 
            }
          });
        }

        if (!customOrder) {
            return res.status(404).json({
                success: false,
                error: 'Custom cake order not found'
            });
        }

        // Check if order is ready for checkout
        if (isImageOrder && customOrder.status !== 'Feasible') {
            return res.status(400).json({
                success: false,
                error: 'Image-based order is not ready for checkout'
            });
        }

        if (!isImageOrder && !['Ready', 'Ready for Checkout', 'Pending'].includes(customOrder.status)) {
            return res.status(400).json({
                success: false,
                error: 'Custom cake order is not ready for checkout'
            });
        }

        // Create Paymongo payment link
        const paymongoResponse = await axios.post(
            'https://api.paymongo.com/v1/links',
            {
                data: {
                    attributes: {
                        amount: Math.round(amount),
                        description: description || `Custom Cake Order`,
                        remarks: `Custom Cake Order for user ${req.user.userID}`,
                        currency: 'PHP',
                        checkout: {
                            name: req.user.name || 'Customer',
                            email: req.user.email
                        },
                        redirect: {
                            success: redirect.success,
                            failed: redirect.failed
                        },
                        payment_method_allowed: ['gcash'],
                        metadata: {
                            userId: req.user.userID,
                            customCakeId: customCakeId,
                            isImageOrder: isImageOrder,
                            orderType: isImageOrder ? 'image_based_cake' : 'custom_3d_cake',
                            deliveryDate: req.body.deliveryDate || null,
                            system: 'Slice N Grind Custom Cakes'
                        }
                    }
                }
            },
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        const paymentLink = paymongoResponse.data.data;
        const checkoutUrl = paymentLink.attributes.checkout_url;

        console.log('Custom cake payment link created:', {
            paymentLinkId: paymentLink.id,
            customCakeId,
            isImageOrder,
            amount: (amount/100).toFixed(2),
            userId: req.user.userID
        });

        res.json({
            success: true,
            checkoutUrl,
            paymentId: paymentLink.id,
            sandboxNote: process.env.NODE_ENV === 'development' ?
                'Use test GCash number 9051111111 for successful payment' : undefined
        });

    } catch (error) {
        console.error('Custom Cake Payment Error:', error);
        
        let statusCode = 500;
        let errorMessage = 'Custom cake payment processing failed';

        if (error.response) {
            statusCode = error.response.status || 500;
            errorMessage = error.response.data?.errors?.[0]?.detail || errorMessage;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/payment/process-cash-custom-cake - Process cash payment for custom cakes
router.post('/process-cash-custom-cake', verifyToken, async (req, res) => {
    try {
        const { customCakeId, isImageOrder, pickupDate } = req.body;

        if (!customCakeId) {
            return res.status(400).json({
                success: false,
                error: 'Custom cake ID is required'
            });
        }

        // Verify custom cake order exists and belongs to user
        let customOrder;
        if (isImageOrder) {
          customOrder = await ImageBasedOrder.findOne({
            where: { 
              id: customCakeId,
              userID: req.user.userID 
            }
          });
        } else {
          customOrder = await CustomCakeOrder.findOne({
            where: { 
              customCakeId: customCakeId,
              userID: req.user.userID 
            }
          });
        }

        if (!customOrder) {
            return res.status(404).json({
                success: false,
                error: 'Custom cake order not found'
            });
        }

        // Update order status for cash payment
        const updateData = { 
          status: 'Pending',
          payment_status: 'pending'
        };
        
        if (pickupDate) {
          updateData.deliveryDate = pickupDate;
        }

        if (isImageOrder) {
          await ImageBasedOrder.update(updateData, { where: { id: customCakeId } });
        } else {
          await CustomCakeOrder.update(updateData, { where: { customCakeId: customCakeId } });
        }

        console.log(`Cash payment processed for custom cake: ${customCakeId}, type: ${isImageOrder ? 'image' : '3d'}`);

        res.json({
            success: true,
            message: 'Cash payment processed successfully',
            orderId: customCakeId,
            orderType: isImageOrder ? 'image_based' : 'custom_3d'
        });

    } catch (error) {
        console.error('Cash payment processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process cash payment',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// POST /api/payment/webhook - Handle Paymongo webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let transaction;
    try {
        const signature = req.headers['paymongo-signature'];
        const payload = req.body.toString();

        // Verify signature in production
        if (process.env.NODE_ENV === 'production') {
            if (!verifyWebhookSignature(signature, payload, PAYMONGO_WEBHOOK_SECRET)) {
                console.warn('Invalid webhook signature');
                return res.status(401).send('Invalid signature');
            }
        }

        const event = JSON.parse(payload);
        console.log('Received Paymongo webhook:', event.data.type);

        if (event.data.type === 'payment.paid') {
            transaction = await sequelize.transaction();
            const payment = event.data.attributes;
            const metadata = payment.metadata || {};
            const paymentId = payment.id;
            const items = metadata.items || [];
            const userId = metadata.userId;

            // Check if this is a custom cake order
            if (metadata.customCakeId) {
                const { customCakeId, isImageOrder, deliveryDate } = metadata;
                
                console.log('Processing custom cake webhook:', {
                    customCakeId,
                    isImageOrder,
                    deliveryDate,
                    paymentId
                });

                const updateData = { 
                    status: 'In Progress',
                    payment_status: 'paid'
                };
                
                if (deliveryDate) {
                    updateData.deliveryDate = new Date(deliveryDate);
                }

                if (isImageOrder) {
                    await ImageBasedOrder.update(updateData, { 
                        where: { id: customCakeId },
                        transaction 
                    });
                    console.log(`Updated image-based order ${customCakeId}`);
                } else {
                    await CustomCakeOrder.update(updateData, { 
                        where: { customCakeId: customCakeId },
                        transaction 
                    });
                    console.log(`Updated custom cake order ${customCakeId}`);
                }

                await transaction.commit();
                return res.status(200).end();
            }

            // Handle regular orders
            let order = await Order.findOne({
                where: { payment_id: paymentId },
                transaction
            });

            if (order && order.payment_verified) {
                console.log(`Payment ${paymentId} already processed, skipping`);
                await transaction.commit();
                return res.status(200).end();
            }

            if (!order) {
                // Create new order
                order = await Order.create({
                    userID: userId,
                    total_amount: payment.amount / 100,
                    status: 'processing',
                    payment_id: paymentId,
                    payment_verified: true,
                    payment_method: 'gcash',
                    delivery_method: items[0]?.deliveryMethod || 'pickup',
                    customer_name: payment.checkout?.name || 'Customer',
                    customer_email: payment.checkout?.email,
                    customer_phone: payment.checkout?.phone || 'Not provided',
                    delivery_address: items[0]?.customerInfo?.deliveryAddress || null,
                    items: items
                }, { transaction });

                // Create order items
                if (items.length > 0) {
                    await OrderItem.bulkCreate(
                        items.map(item => ({
                            orderId: order.orderId,
                            menuId: item.menuId,
                            sizeId: item.sizeId,
                            quantity: item.quantity,
                            price: item.price,
                            item_name: item.name,
                            size_name: item.size
                        })),
                        { transaction }
                    );
                }
            } else {
                // Update existing order
                await order.update({
                    status: 'processing',
                    payment_verified: true
                }, { transaction });
            }

            // Clear user cart
            if (userId) {
                console.log(`Clearing cart for user ${userId}`);
                const cart = await Cart.findOne({ 
                    where: { userID: userId },
                    transaction
                });

                if (cart) {
                    const deletedCount = await CartItem.destroy({
                        where: { cartId: cart.cartId },
                        transaction
                    });
                    console.log(`Cleared ${deletedCount} cart items`);
                }
            }

            await transaction.commit();
            return res.status(200).end();
        }

        res.status(200).end();
    } catch (error) {
        console.error('Webhook processing error:', error);
        if (transaction) await transaction.rollback();
        return res.status(200).json({ success: false });
    }
});

// GET /api/payment/verify-payment/:paymentId - Verify payment status by payment ID
router.get('/verify-payment/:paymentId', verifyToken, async (req, res) => {
    try {
        const { paymentId } = req.params;

        const response = await axios.get(
            `https://api.paymongo.com/v1/links/${paymentId}`,
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`
                },
                timeout: 5000
            }
        );

        const paymentData = response.data.data;
        const paymentStatus = paymentData.attributes.status;
        const isPaid = paymentStatus === 'paid';

        if (paymentData.attributes.currency !== 'PHP') {
            throw new Error('Invalid currency');
        }

        res.json({
            success: true,
            status: paymentStatus,
            isPaid,
            paidAt: paymentData.attributes.paid_at,
            amount: paymentData.attributes.amount / 100,
            currency: paymentData.attributes.currency,
            paymentMethod: paymentData.attributes.payments[0]?.source?.type || 'gcash'
        });

    } catch (error) {
        console.error('Payment verification failed:', error);

        let statusCode = 500;
        let errorMessage = 'Payment verification failed';

        if (error.response?.status === 404) {
            statusCode = 404;
            errorMessage = 'Payment not found';
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ?
                (error.response?.data?.errors || error.message) : undefined
        });
    }
});

module.exports = router;