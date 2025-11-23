const express = require("express");
const router = express.Router();
const sequelize = require("../config/database");
const {
  Order,
  Cart,
  CartItem,
  MenuItem,
  ItemSize,
  OrderItem,
  User,
  CustomCakeOrder,
} = require("../models");
const { Notification } = require("../models");
const verifyToken = require("../middleware/verifyToken");
const allowCustomerOnly = require("../middleware/checkOrderPermission");
const { Op } = require("sequelize");

//Middleware to check admin/staff permissions
const checkAdminOrStaff = (req, res, next) => {
  const userLevel = req.user.userLevel.toLowerCase();
  if (!["admin", "staff"].includes(userLevel)) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized: Admin or staff access required",
    });
  }
  next();
};

//Status mapping function
const statusMap = {
  pending: "Pending",
  pending_payment: "Pending Payment",
  order_received: "Order Submitted", // Changed from "Order Received" to "Order Submitted"
  processing: "In Progress",
  shipped: "Ready for Delivery",
  delivered: "Completed",
  cancelled: "Cancelled",
};

//Helper function to format status
function formatStatus(status) {
  return statusMap[status] || status;
}

//Helper function to create order items and update stock
const createOrderItems = async (orderId, items, transaction) => {
  await Promise.all(
    items.map(async (item) => {
      if (item.customCakeId) {
        const customCake = await CustomCakeOrder.findByPk(item.customCakeId, {
          transaction,
        });
        if (!customCake) {
          throw new Error(`Custom cake order ${item.customCakeId} not found`);
        }
        if (customCake.status !== "Feasible") {
          throw new Error(
            `Custom cake order ${item.customCakeId} is not Feasible`
          );
        }
        await OrderItem.create(
          {
            orderId,
            customCakeId: item.customCakeId,
            quantity: item.quantity,
            price: item.price,
            item_name: item.name,
            size_name: item.size,
          },
          { transaction }
        );
      } else {
        await OrderItem.create(
          {
            orderId,
            menuId: item.menuId,
            sizeId: item.sizeId,
            quantity: item.quantity,
            price: item.price,
            item_name: item.name,
            size_name: item.size,
          },
          { transaction }
        );

        const menuItem = await MenuItem.findByPk(item.menuId, {
          include: [
            {
              model: ItemSize,
              as: "sizes",
              where: { isActive: true },
              required: false,
            },
          ],
          transaction,
        });

        if (!menuItem) {
          throw new Error(`Menu item ${item.menuId} not found`);
        }

        if (menuItem.hasSizes && item.size) {
          const validSize = menuItem.sizes.find(
            (s) =>
              s.sizeName.trim().toLowerCase() === item.size.trim().toLowerCase()
          );
          if (!validSize) {
            throw new Error(
              `Invalid size ${item.size} for menu item ${item.menuId}`
            );
          }
          if (validSize.stock < item.quantity) {
            throw new Error(
              `Insufficient stock for ${item.size} of ${item.name}`
            );
          }
          await validSize.update(
            { stock: validSize.stock - item.quantity },
            { transaction }
          );
        } else {
          if (menuItem.stock < item.quantity) {
            throw new Error(`Insufficient stock for ${item.name}`);
          }
          await menuItem.update(
            { stock: menuItem.stock - item.quantity },
            { transaction }
          );
        }
      }
    })
  );
};

//Helper function to clear cart
const clearCart = async (userID, transaction) => {
  const cart = await Cart.findOne({ where: { userID }, transaction });
  if (cart) {
    await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
    console.log(`Cleared cart for user ${userID}`);
  }
};

//Helper function to format orders
const formatOrders = (orders) => {
  return orders
    .filter((order) => {
      //Filter out orders that contain custom cakes
      const hasCustomCake = order.orderItems.some((item) => item.customCakeId);
      return !hasCustomCake;
    })
    .map((order) => ({
      ...order.toJSON(),
      customer_name: order.customer_name, // Ensure these are included
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      user: order.customer
        ? {
            userID: order.customer.userID,
            name: order.customer.name,
            email: order.customer.email,
          }
        : null,
      updater: order.updater
        ? {
            userID: order.updater.userID,
            name: order.updater.name,
            email: order.updater.email,
            userLevel: order.updater.userLevel,
          }
        : null,
      items: order.orderItems
        .filter((item) => !item.customCakeId) // Only show non-custom cake items
        .map((item) => ({
          menuId: item.menuId,
          customCakeId: item.customCakeId,
          name: item.MenuItem?.name || item.item_name || "Unknown",
          size: item.size_name || null,
          price: item.price,
          quantity: item.quantity,
          image: item.MenuItem?.image || null,
        })),
    }))
    .filter((order) => order.items.length > 0);
};

//Helper function to create order notifications
const createOrderNotification = async (userID, title, message, orderId) => {
  try {
    const notificationKey = `order_${orderId}`;

    // Create or update notification
    const [notification] = await Notification.findOrCreate({
      where: {
        userID: userID,
        notificationKey: notificationKey,
      },
      defaults: {
        isRead: false,
      },
    });

    // If notification already exists, reset it to unread
    if (notification.isRead) {
      await notification.update({ isRead: false });
    }

    console.log("✅ Created/updated notification for order:", orderId);
  } catch (error) {
    console.error("Error creating order notification:", error);
  }
};

//POST /api/orders/create - Create new order
router.post("/create", verifyToken, allowCustomerOnly, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      items,
      totalAmount,
      paymentMethod,
      deliveryMethod,
      pickupDate,
      customerInfo,
    } = req.body;

    // Validate required fields
    if (
      !items ||
      !totalAmount ||
      !paymentMethod ||
      !deliveryMethod ||
      !customerInfo ||
      !pickupDate
    ) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    let initialStatus;
    if (paymentMethod === "gcash") {
      initialStatus = "pending_payment";
    } else {
      initialStatus = "order_received";
    }

    // Create order
    const order = await Order.create(
      {
        userID: req.user.userID,
        total_amount: totalAmount,
        status: initialStatus,
        payment_method: paymentMethod,
        payment_verified: paymentMethod === "cash",
        delivery_method: deliveryMethod,
        pickup_date: pickupDate,
        customer_name: customerInfo.fullName,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        delivery_address:
          deliveryMethod === "delivery" ? customerInfo.deliveryAddress : null,
        items: items,
      },
      { transaction }
    );

    // Create order items and reduce stock
    await createOrderItems(order.orderId, items, transaction);

    // Clear cart
    await clearCart(req.user.userID, transaction);

    await transaction.commit();
    res.json({
      success: true,
      message: "Order created successfully",
      orderId: order.orderId,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/orders/verify-gcash-payment - Verify GCash payment and update order
router.post(
  "/verify-gcash-payment",
  verifyToken,
  allowCustomerOnly,
  async (req, res) => {
    let transaction;
    try {
      transaction = await sequelize.transaction();
      const { paymentId, orderData } = req.body;
      let order = await Order.findOne({
        where: { payment_id: paymentId },
        transaction,
      });

      if (!order) {
        order = await Order.create(
          {
            userID: req.user.userID,
            total_amount: orderData.totalAmount,
            status: "order_received",
            payment_method: "gcash",
            payment_verified: true,
            payment_id: paymentId,
            delivery_method: orderData.deliveryMethod,
            pickup_date: orderData.pickupDate,
            customer_name: orderData.customerInfo.fullName,
            customer_email: orderData.customerInfo.email,
            customer_phone: orderData.customerInfo.phone,
            delivery_address:
              orderData.deliveryMethod === "delivery"
                ? orderData.customerInfo.deliveryAddress
                : null,
            items: orderData.items,
          },
          { transaction }
        );

        await createOrderItems(order.orderId, orderData.items, transaction);
        await clearCart(req.user.userID, transaction);
      } else if (order.status === "pending_payment") {
        await order.update(
          {
            status: "order_received",
            payment_verified: true,
            pickup_date: orderData.pickupDate,
          },
          { transaction }
        );

        await Promise.all(
          orderData.items.map(async (item) => {
            const existingOrderItem = await OrderItem.findOne({
              where: {
                orderId: order.orderId,
                menuId: item.menuId,
                size_name: item.size,
                customCakeId: item.customCakeId || null,
              },
              transaction,
            });
            if (!existingOrderItem) {
              await OrderItem.create(
                {
                  orderId: order.orderId,
                  customCakeId: item.customCakeId,
                  menuId: item.menuId,
                  sizeId: item.sizeId,
                  quantity: item.quantity,
                  price: item.price,
                  item_name: item.name,
                  size_name: item.size,
                },
                { transaction }
              );

              if (!item.customCakeId) {
                const menuItem = await MenuItem.findByPk(item.menuId, {
                  include: [
                    {
                      model: ItemSize,
                      as: "sizes",
                      where: { isActive: true },
                      required: false,
                    },
                  ],
                  transaction,
                });

                if (!menuItem) {
                  throw new Error(`Menu item ${item.menuId} not found`);
                }

                if (menuItem.hasSizes && item.size) {
                  const validSize = menuItem.sizes.find(
                    (s) =>
                      s.sizeName.trim().toLowerCase() ===
                      item.size.trim().toLowerCase()
                  );
                  if (!validSize) {
                    throw new Error(
                      `Invalid size ${item.size} for menu item ${item.menuId}`
                    );
                  }
                  if (validSize.stock < item.quantity) {
                    throw new Error(
                      `Insufficient stock for ${item.size} of ${item.name}`
                    );
                  }
                  await validSize.update(
                    { stock: validSize.stock - item.quantity },
                    { transaction }
                  );
                } else {
                  if (menuItem.stock < item.quantity) {
                    throw new Error(`Insufficient stock for ${item.name}`);
                  }
                  await menuItem.update(
                    { stock: menuItem.stock - item.quantity },
                    { transaction }
                  );
                }
              }
            }
          })
        );

        await clearCart(req.user.userID, transaction);
      }

      await transaction.commit();
      return res.json({ success: true, order });
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error("GCash verification failed:", error);
      return res.status(500).json({
        success: false,
        message: "Payment verification failed",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// GET /api/orders/user/me - Get user orders with order items
router.get("/user/me", verifyToken, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { userID: req.user.userID },
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            {
              model: MenuItem,
              attributes: ["name", "image"], // ← MAKE SURE image IS INCLUDED
            },
            { model: ItemSize, attributes: ["sizeName"] },
            {
              model: CustomCakeOrder,
              attributes: [
                "size",
                "cakeColor",
                "icingStyle",
                "icingColor",
                "filling",
                "bottomBorder",
                "topBorder",
                "bottomBorderColor",
                "topBorderColor",
                "decorations",
                "flowerType",
                "customText",
                "messageChoice",
                "toppingsColor",
                "imageUrl",
                "status",
              ],
            },
          ],
        },
      ],
    });

    // FIXED: Filter to ONLY return orders WITHOUT any custom cake items
    const regularOrdersOnly = orders.filter((order) => {
      // Exclude entire order if it contains ANY custom cake items
      const hasCustomCake = order.orderItems.some((item) => item.customCakeId);
      return !hasCustomCake;
    });

    res.json({ success: true, orders: formatOrders(regularOrdersOnly) });
  } catch (error) {
    console.error("Error in /user/me:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/orders/:orderId - Get single order with details
router.get("/:orderId", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { orderId: req.params.orderId, userID: req.user.userID },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
          include: [
            { model: MenuItem },
            { model: ItemSize },
            { model: CustomCakeOrder },
          ],
        },
      ],
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ success: false, message: "Error fetching order" });
  }
});

// PUT /api/orders/:orderId/status - Update order status and payment verification
router.put("/:orderId/status", verifyToken, async (req, res) => {
  try {
    const { status, paymentId, payment_verified } = req.body;
    const order = await Order.findOne({
      where: { orderId: req.params.orderId, userID: req.user.userID },
    });

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    order.status = status;
    if (paymentId) order.payment_id = paymentId;
    if (payment_verified !== undefined)
      order.payment_verified = payment_verified;
    await order.save();

    res.json({ success: true, message: "Order status updated", order });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ success: false, message: "Error updating order" });
  }
});

// POST /api/orders/cancel/:orderId - Cancel an order
router.post(
  "/cancel/:orderId",
  verifyToken,
  allowCustomerOnly,
  async (req, res) => {
    try {
      const order = await Order.findOne({
        where: { orderId: req.params.orderId, userID: req.user.userID },
      });

      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      if (order.status === "pending_payment") {
        await order.update({ status: "cancelled" });
        await OrderItem.destroy({ where: { orderId: order.orderId } });
        return res.json({ success: true, message: "Order canceled" });
      }

      res.json({
        success: true,
        message: "No action needed",
        status: order.status,
      });
    } catch (error) {
      console.error("Error canceling order:", error);
      res
        .status(500)
        .json({ success: false, message: "Error canceling order" });
    }
  }
);

// GET /api/orders/admin/orders - Get all orders (EXCLUDE custom cakes)
router.get(
  "/admin/orders",
  verifyToken,
  checkAdminOrStaff,
  async (req, res) => {
    try {
      const { pickup_date } = req.query;
      const where = pickup_date ? { pickup_date } : {};

      const orders = await Order.findAll({
        where,
        include: [
          {
            model: User,
            as: "customer",
            attributes: ["userID", "name", "email"],
          },
          {
            model: User,
            as: "updater",
            attributes: ["userID", "name", "email", "userLevel"],
          }, // ADD THIS INCLUDE
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              { model: MenuItem, attributes: ["name", "image"] },
              { model: ItemSize, attributes: ["sizeName", "price"] },
              { model: CustomCakeOrder, attributes: ["size"] }, // Keep for filtering
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // FIXED: Filter out orders with custom cakes
      const regularOrdersOnly = orders.filter((order) => {
        const hasCustomCake = order.orderItems.some(
          (item) => item.customCakeId
        );
        return !hasCustomCake;
      });

      res.json({ success: true, orders: formatOrders(regularOrdersOnly) });
    } catch (error) {
      console.error("Admin orders error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// GET /api/orders/admin/dashboard - Get dashboard data for today
router.get(
  "/admin/dashboard",
  verifyToken,
  checkAdminOrStaff,
  async (req, res) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const todayStart = new Date(today);
      const todayEnd = new Date(today + " 23:59:59");

      // Get today's REGULAR orders (exclude custom cakes)
      const todaysOrders = await Order.findAll({
        where: {
          createdAt: { [Op.between]: [todayStart, todayEnd] },
        },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              { model: MenuItem, attributes: ["name"] },
              { model: CustomCakeOrder, attributes: ["size"] },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // FIXED: Filter out orders with custom cakes from dashboard
      const regularOrdersOnly = todaysOrders.filter((order) => {
        const hasCustomCake = order.orderItems.some(
          (item) => item.customCakeId
        );
        return !hasCustomCake;
      });

      // Get today's new customers (users created today)
      const newCustomers = await User.findAll({
        where: {
          createdAt: { [Op.between]: [todayStart, todayEnd] },
        },
      });

      // Get pending custom cake orders for notifications
      const pendingCustomCakes = await CustomCakeOrder.findAll({
        where: {
          status: "Pending Review",
          createdAt: { [Op.between]: [todayStart, todayEnd] },
        },
        limit: 10,
      });

      // Get new orders in the last 30 minutes for notifications (REGULAR ORDERS ONLY)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const newOrders = await Order.findAll({
        where: {
          createdAt: { [Op.gte]: thirtyMinutesAgo },
        },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            attributes: ["item_name"],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 10,
      });

      //Filter new orders to exclude custom cakes
      const newRegularOrders = newOrders.filter((order) => {
        const hasCustomCake = order.orderItems.some(
          (item) => item.customCakeId
        );
        return !hasCustomCake;
      });

      //Calculate summary statistics (from regular orders only)
      const totalRevenue = regularOrdersOnly.reduce(
        (sum, order) => sum + parseFloat(order.total_amount),
        0
      );

      //Format orders for response
      function formatOrderId(orderId) {
        return "ORD" + orderId.toString().padStart(3, "0");
      }

      const formattedOrders = regularOrdersOnly.map((order) => ({
        orderId: formatOrderId(order.orderId),
        customer_name: order.customer_name,
        customer_email: order.customer_email, // ADD THIS
        customer_phone: order.customer_phone, // ADD THIS
        total_amount: parseFloat(order.total_amount) || 0,
        status: formatStatus(order.status),
        status_key: order.status,
        order_date: order.createdAt,
        pickup_date: order.pickup_date,
        payment_method: order.payment_method || "unknown",
        delivery_method: order.delivery_method || "unknown",
        items: order.orderItems.map((item) => ({
          name: item.MenuItem?.name || item.item_name,
          size: item.size_name || null,
          quantity: parseInt(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
        })),
      }));

      //Format new orders for notifications
      const formattedNewOrders = newRegularOrders.map((order) => ({
        orderId: formatOrderId(order.orderId),
        customer_name: order.customer_name,
        items: order.orderItems.map((item) => item.item_name).join(", "),
        time: order.createdAt,
      }));

      res.json({
        success: true,
        summary: {
          total_revenue: totalRevenue,
          total_orders: regularOrdersOnly.length,
          regular_orders: regularOrdersOnly.length,
          new_customers: newCustomers.length,
        },
        orders: formattedOrders,
        notifications: {
          new_orders: formattedNewOrders.length,
          pending_custom_cakes: pendingCustomCakes.length,
          total: formattedNewOrders.length + pendingCustomCakes.length,
        },
        new_orders: formattedNewOrders,
        pending_custom_cakes: pendingCustomCakes,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);
router.get(
  "/admin/reports",
  verifyToken,
  checkAdminOrStaff,
  async (req, res) => {
    try {
      const { start_date, end_date } = req.query;

      console.log("=== REPORTS DEBUG ===");
      console.log("Request dates:", { start_date, end_date });

      // FIX: Handle timezone conversion properly for +08:00
      const startDate = start_date
        ? new Date(start_date + "T00:00:00+08:00") // Start of day in +08:00
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const endDate = end_date
        ? new Date(end_date + "T23:59:59.999+08:00") // End of day in +08:00
        : new Date();

      console.log("Date range in +08:00 timezone:");
      console.log("  Start:", startDate.toISOString());
      console.log("  End:", endDate.toISOString());
      console.log("  Current time:", new Date().toISOString());

      // Get orders with their items
      const orders = await Order.findAll({
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
          status: {
            [Op.notIn]: ["Cancelled", "cancelled"],
          },
        },
        include: [
          {
            model: OrderItem,
            as: "orderItems",
            include: [
              { model: MenuItem, attributes: ["name"] },
              { model: CustomCakeOrder, attributes: ["size"] },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      console.log(`Found ${orders.length} total orders`);

      // Filter to regular orders only
      const regularOrdersOnly = orders.filter((order) => {
        const hasCustomCake = order.orderItems.some(
          (item) => item.customCakeId
        );
        return !hasCustomCake;
      });

      console.log(
        `Found ${regularOrdersOnly.length} regular orders after filtering custom cakes`
      );

      // Format orders
      const formattedOrders = regularOrdersOnly.map((order) => ({
        orderId: "ORD" + order.orderId.toString().padStart(3, "0"),
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        total_amount: parseFloat(order.total_amount) || 0,
        status: formatStatus(order.status),
        status_key: order.status,
        order_date: order.createdAt,
        pickup_date: order.pickup_date || null,
        payment_method: order.payment_method || "unknown",
        delivery_method: order.delivery_method || "unknown",
        items: order.orderItems.map((item) => ({
          name: item.MenuItem?.name || item.item_name,
          size: item.size_name || null,
          quantity: parseInt(item.quantity) || 0,
          price: parseFloat(item.price) || 0,
        })),
      }));

      // For daily orders
      const dailyOrders = await Order.findAll({
        attributes: [
          [sequelize.fn("DATE", sequelize.col("createdAt")), "date"],
          [sequelize.fn("COUNT", sequelize.col("orderId")), "count"],
        ],
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
          status: {
            [Op.notIn]: ["Cancelled", "cancelled"],
          },
        },
        group: [sequelize.fn("DATE", sequelize.col("createdAt"))],
        order: [[sequelize.fn("DATE", sequelize.col("createdAt")), "ASC"]],
      });

      console.log(`Daily orders count: ${dailyOrders.length}`);

      // FIX: Get popular items without the wrong association
      // First, get all ACTIVE order IDs within the date range
      const activeOrders = await Order.findAll({
        attributes: ["orderId"],
        where: {
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
          status: {
            [Op.notIn]: ["Cancelled", "cancelled"],
          },
        },
      });

      const activeOrderIds = activeOrders.map((order) => order.orderId);

      console.log(`Active order IDs: ${activeOrderIds.length}`);

      // Then get order items only for active orders
      const allOrderItems = await OrderItem.findAll({
        where: {
          orderId: {
            [Op.in]: activeOrderIds,
          },
          customCakeId: null, // Only regular menu items
          createdAt: {
            [Op.between]: [startDate, endDate],
          },
        },
      });

      console.log(
        `Found ${allOrderItems.length} order items from active orders`
      );

      const itemCounts = {};
      allOrderItems.forEach((item) => {
        const itemName = item.item_name || "Unknown Item";
        itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
      });

      const popularItems = Object.entries(itemCounts)
        .map(([item_name, total_quantity]) => ({ item_name, total_quantity }))
        .sort((a, b) => b.total_quantity - a.total_quantity)
        .slice(0, 10);

      console.log(`Popular items: ${popularItems.length}`);

      const totalRevenue = regularOrdersOnly.reduce(
        (sum, order) => sum + parseFloat(order.total_amount),
        0
      );

      console.log("=== END DEBUG ===");

      res.json({
        success: true,
        orders: formattedOrders,
        daily_orders: dailyOrders,
        popular_items: popularItems,
        summary: {
          total_orders: regularOrdersOnly.length,
          total_revenue: totalRevenue,
          regular_orders: regularOrdersOnly.length,
          average_order_value: regularOrdersOnly.length
            ? totalRevenue / regularOrdersOnly.length
            : 0,
        },
        date_range: {
          start_date: start_date || startDate.toISOString().split("T")[0],
          end_date: end_date || endDate.toISOString().split("T")[0],
        },
      });
    } catch (error) {
      console.error("Reports error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

router.put(
  "/admin/orders/:orderId",
  verifyToken,
  checkAdminOrStaff,
  async (req, res) => {
    const { status } = req.body;
    try {
      if (
        ![
          "pending",
          "pending_payment",
          "order_received",
          "processing",
          "shipped",
          "delivered",
          "cancelled",
        ].includes(status)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid status" });
      }
      const order = await Order.findByPk(req.params.orderId);
      if (!order) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }

      //Create notification when status changes
      await createOrderNotification(
        order.userID,
        "Order Status Updated",
        `Your order #ORD${order.orderId
          .toString()
          .padStart(3, "0")} status has been updated to: ${formatStatus(
          status
        )}`,
        order.orderId
      );

      //Capture who updated the order
      await order.update({
        status,
        updatedBy: req.user.userID,
      });

      res.json({ success: true, message: "Order status updated", order });
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
