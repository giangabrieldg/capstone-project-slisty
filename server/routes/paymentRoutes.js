const express = require('express');
const axios = require('axios');
const router = express.Router();
const { PAYMONGO_SECRET_KEY } = process.env;

// Create GCash payment source
router.post('/create-gcash-source', async (req, res) => {
  try {
    const { amount, description, orderId } = req.body; // Amount in centavos, e.g., 10000 for PHP 100
    const response = await axios.post(
      'https://api.paymongo.com/v1/sources',
      {
        data: {
          attributes: {
            amount,
            currency: 'PHP',
            type: 'gcash',
            redirect: {
              success: 'http://localhost:3000/success', // Update with your deployed success URL
              failed: 'http://localhost:3000/failed', // Update with your deployed failure URL
            },
            description: description || 'Slice N Grind Order',
            metadata: { orderId }, // Store orderId for webhook reference
          },
        },
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const checkoutUrl = response.data.data.attributes.redirect.checkout_url;
    res.json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating GCash source:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create payment source' });
  }
});

// Webhook to handle payment confirmation
router.post('/webhook', express.json(), async (req, res) => {
  const payload = req.body;
  const eventType = payload.data.attributes.type;

  if (eventType === 'source.chargeable') {
    const { amount, id: sourceId, metadata } = payload.data.attributes.data.attributes;
    const { orderId } = metadata || {};
    
    try {
      // Create Payment resource
      const paymentResponse = await axios.post(
        'https://api.paymongo.com/v1/payments',
        {
          data: {
            attributes: {
              amount,
              currency: 'PHP',
              source: { id: sourceId, type: 'source' },
              description: 'Slice N Grind Order Payment',
              metadata: { orderId },
            },
          },
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(PAYMONGO_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Update order status in database
      const { sequelize } = require('../models'); // Adjust path to your Sequelize models
      await sequelize.models.Order.update(
        { status: 'paid', payment_id: paymentResponse.data.data.id },
        { where: { id: orderId } }
      );

      console.log('Payment successful:', paymentResponse.data);
      res.status(200).send('Webhook received');
    } catch (error) {
      console.error('Error processing payment:', error.response?.data || error.message);
      res.status(500).send('Webhook error');
    }
  } else {
    res.status(200).send('Event not handled');
  }
});

module.exports = router;