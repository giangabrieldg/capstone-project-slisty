
const { Order } = require('../models');

module.exports = async (req, res, next) => {
  if (req.path.includes('/success')) {
    const { orderId } = req.query;
    if (!orderId) return res.redirect('/failed?reason=no_order_id');

    try {
      const order = await Order.findOne({ where: { id: orderId } });
      
      if (!order) return res.redirect('/failed?reason=order_not_found');
      if (order.status !== 'paid') {
        return res.redirect('/pending-payment?orderId=' + orderId);
      }
      
      // Payment verified, proceed to success page
      next();
    } catch (error) {
      res.redirect('/failed?reason=verification_error');
    }
  } else {
    next();
  }
};