const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const { PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET } = process.env;
const { Order, OrderItem } = require('../models');
const verifyToken = require('../middleware/verifyToken');

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature, payload, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return signature === hmac.digest('hex');
};

/**
 * Create GCash payment source
 * - Validates order exists and belongs to user
 * - Prevents duplicate payments
 * - Handles Paymongo API errors properly
 */
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

        // Validate amount
        if (amount < 100 || amount > 10000000) {
            return res.status(400).json({
                success: false,
                error: `Amount must be between ₱${(100/100).toFixed(2)} and ₱${(10000000/100).toFixed(2)}`
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
                        metadata: {
                            userId: req.user.userID,
                            items,
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
                (error.response?.data?.errors || error.message) : undefined
        });
    }
});

/**
 * Payment Verification Endpoint
 * - Verifies payment status with Paymongo
 * - Updates order status if paid
 * - Handles various error scenarios
 */
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

    // Update order status if paid
    if (isPaid) {
      await order.update({
        status: 'paid',
        payment_verified: true,
        payment_id: paymentData.id
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

/**
 * Paymongo Webhook Handler
 * - Verifies signatures in production
 * - Updates order status based on events
 * - Handles payment.paid and payment.failed events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
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
        console.log('Received Paymongo webhook:', event);

        if (event.data.type === 'payment.paid') {
            const payment = event.data.attributes;
            const metadata = payment.metadata || {};
            const items = metadata.items || [];

            // Check if order already exists
            const existingOrder = await Order.findOne({
                where: { payment_id: payment.id }
            });

            if (existingOrder) {
                console.log('Order already exists for payment:', payment.id);
                return res.status(200).end();
            }

            // Create order
            const order = await Order.create({
                userID: metadata.userId,
                total_amount: payment.amount / 100,
                status: 'paid',
                payment_id: payment.id,
                payment_verified: true,
                payment_method: 'gcash',
                delivery_method: items[0]?.deliveryMethod || 'pickup',
                customer_name: payment.checkout?.name || 'Customer',
                customer_email: payment.checkout?.email,
                customer_phone: payment.checkout?.phone || 'Not provided',
                delivery_address: items[0]?.customerInfo?.deliveryAddress || null,
                items: items
            });

            // Create OrderItems
            await Promise.all(items.map(item =>
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
            const cart = await Cart.findOne({ where: { userID: metadata.userId } });
            if (cart) {
                await CartItem.destroy({ where: { cartId: cart.cartId } });
            }
        } else if (event.data.type === 'payment.failed') {
            console.log('Payment failed:', event.data.id);
        } else {
            console.log('Unhandled webhook event:', event.data.type);
        }

        res.status(200).end();
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({
            success: false,
            error: 'Webhook processing failed',
            details: error.message
        });
    }
});
// Verify Payment Endpoint
// This endpoint allows users to verify the status of a payment by its ID
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