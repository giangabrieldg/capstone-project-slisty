const { Order, OrderItem } = require('../models');
const { Op } = require('sequelize');

async function cleanupAbandonedOrders() {
    try {
        const timeout = 30 * 60 * 1000; // 30 minutes
        const cutoffTime = new Date(Date.now() - timeout);

        const abandonedOrders = await Order.findAll({
            where: {
                status: 'pending_payment',
                createdAt: { [Op.lt]: cutoffTime }
            }
        });

        for (const order of abandonedOrders) {
            await OrderItem.destroy({ where: { orderId: order.orderId } });
            await order.update({ status: 'canceled' });
            console.log(`Canceled abandoned order ${order.orderId}`);
        }
    } catch (error) {
        console.error('Error cleaning up abandoned orders:', error);
    }
}

setInterval(cleanupAbandonedOrders, 10 * 60 * 1000);
module.exports = { cleanupAbandonedOrders };