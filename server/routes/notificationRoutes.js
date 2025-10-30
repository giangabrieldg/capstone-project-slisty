const express = require("express");
const router = express.Router();
const {
  Notification,
  Order,
  CustomCakeOrder,
  ImageBasedOrder,
} = require("../models");
const verifyToken = require("../middleware/verifyToken");
const { Op } = require("sequelize");

//GET /api/notifications - Get user notifications
router.get("/", verifyToken, async (req, res) => {
  try {
    console.log("🔍 GET /notifications for user:", req.user.userID);

    // AUTO-CREATE NOTIFICATIONS FOR EXISTING ORDERS
    await autoCreateNotifications(req.user.userID);

    //Get read status from database (after auto-creating)
    const readStatuses = await Notification.findAll({
      where: { userID: req.user.userID },
      attributes: ["notificationKey", "isRead"],
    });

    console.log(
      "🔍 Read statuses from DB after auto-create:",
      readStatuses.length
    );

    //Create a map of read statuses
    const readStatusMap = new Map();
    readStatuses.forEach((status) => {
      readStatusMap.set(status.notificationKey, status.isRead);
    });

    //Get recent orders for generating notifications
    const [orders, customCakes, imageOrders] = await Promise.all([
      Order.findAll({
        where: { userID: req.user.userID },
        order: [["updatedAt", "DESC"]],
        limit: 10,
      }),
      CustomCakeOrder.findAll({
        where: { userID: req.user.userID },
        order: [["updatedAt", "DESC"]],
        limit: 10,
      }),
      ImageBasedOrder.findAll({
        where: { userID: req.user.userID },
        order: [["updatedAt", "DESC"]],
        limit: 10,
      }),
    ]);

    //Format as notifications
    const notifications = [];

    //Add regular orders
    orders.forEach((order) => {
      const notificationKey = `order_${order.orderId}`;
      notifications.push({
        id: notificationKey,
        type: "order",
        title: "Order Update",
        message: `Order #ORD${order.orderId
          .toString()
          .padStart(3, "0")} is ${formatStatus(order.status)}`,
        time: order.updatedAt,
        isRead: readStatusMap.get(notificationKey) || false,
        relatedId: order.orderId,
      });
    });

    //Add custom cake orders
    customCakes.forEach((cake) => {
      const notificationKey = `cake_${cake.customCakeId}`;
      notifications.push({
        id: notificationKey,
        type: "custom_cake",
        title: "Custom Cake Update",
        message: `Your custom cake order is ${cake.status}`,
        time: cake.updatedAt,
        isRead: readStatusMap.get(notificationKey) || false,
        relatedId: cake.customCakeId,
      });
    });

    //Add image-based orders
    imageOrders.forEach((order) => {
      const notificationKey = `image_${order.imageBasedOrderId}`;
      notifications.push({
        id: notificationKey,
        type: "image_order",
        title: "Image Based Custom Cake Update",
        message: `Your image based custom cake order is ${order.status}`,
        time: order.updatedAt,
        isRead: readStatusMap.get(notificationKey) || false,
        relatedId: order.imageBasedOrderId,
      });
    });

    //Sort by time (newest first) and limit to 15
    notifications.sort((a, b) => new Date(b.time) - new Date(a.time));

    console.log("Final notifications count:", notifications.length);

    res.json({ success: true, notifications: notifications.slice(0, 15) });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
});

//GET /api/notifications/unread-count - Get unread count
router.get("/unread-count", verifyToken, async (req, res) => {
  try {
    console.log("🔍 GET /unread-count for user:", req.user.userID);

    //AUTO-CREATE NOTIFICATIONS FIRST
    await autoCreateNotifications(req.user.userID);

    //Count unread notifications from database
    const unreadCount = await Notification.count({
      where: {
        userID: req.user.userID,
        isRead: false,
      },
    });

    console.log("🔍 Unread count after auto-create:", unreadCount);

    res.json({ success: true, count: unreadCount });
  } catch (error) {
    console.error("Error counting notifications:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to count notifications" });
  }
});

//POST /api/notifications/mark-read - Mark all notifications as read
router.post("/mark-read", verifyToken, async (req, res) => {
  try {
    // Mark all as read
    await Notification.update(
      { isRead: true },
      {
        where: {
          userID: req.user.userID,
        },
      }
    );

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
    });
  }
});

//POST /api/notifications/:notificationKey/read - Mark single notification as read
router.post("/:notificationKey/read", verifyToken, async (req, res) => {
  try {
    const notificationKey = req.params.notificationKey;

    //Create or update the read status
    const [notification] = await Notification.findOrCreate({
      where: {
        userID: req.user.userID,
        notificationKey: notificationKey,
      },
      defaults: {
        isRead: true,
      },
    });

    //If it already existed, mark it as read
    if (!notification.isRead) {
      await notification.update({ isRead: true });
    }

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark notification as read" });
  }
});

//Helper function to format status
function formatStatus(status) {
  const statusMap = {
    pending: "Pending",
    pending_payment: "Pending Payment",
    order_received: "Order Received",
    processing: "In Progress",
    shipped: "Ready for Delivery",
    delivered: "Completed",
    cancelled: "Cancelled",
  };
  return statusMap[status] || status;
}

const autoCreateNotifications = async (userID) => {
  try {
    console.log("🔄 Auto-creating notifications for user:", userID);

    //Get user's recent orders
    const [orders, customCakes, imageOrders] = await Promise.all([
      Order.findAll({
        where: { userID: userID },
        order: [["updatedAt", "DESC"]],
        limit: 15,
      }),
      CustomCakeOrder.findAll({
        where: { userID: userID },
        order: [["updatedAt", "DESC"]],
        limit: 15,
      }),
      ImageBasedOrder.findAll({
        where: { userID: userID },
        order: [["updatedAt", "DESC"]],
        limit: 15,
      }),
    ]);

    console.log("🔄 Found for auto-create:", {
      orders: orders.length,
      customCakes: customCakes.length,
      imageOrders: imageOrders.length,
    });

    const notificationCreates = [];

    //Create notifications for regular orders
    orders.forEach((order) => {
      const notificationKey = `order_${order.orderId}`;
      notificationCreates.push(
        Notification.findOrCreate({
          where: {
            userID: userID,
            notificationKey: notificationKey,
          },
          defaults: {
            isRead: false,
          },
        })
      );
    });

    //Create notifications for custom cakes
    customCakes.forEach((cake) => {
      const notificationKey = `cake_${cake.customCakeId}`;
      notificationCreates.push(
        Notification.findOrCreate({
          where: {
            userID: userID,
            notificationKey: notificationKey,
          },
          defaults: {
            isRead: false,
          },
        })
      );
    });

    //Create notifications for image orders
    imageOrders.forEach((order) => {
      const notificationKey = `image_${order.imageBasedOrderId}`;
      notificationCreates.push(
        Notification.findOrCreate({
          where: {
            userID: userID,
            notificationKey: notificationKey,
          },
          defaults: {
            isRead: false,
          },
        })
      );
    });

    await Promise.all(notificationCreates);
  } catch (error) {
    console.error("auto-creating notifications:", error);
  }
};

module.exports = router;
