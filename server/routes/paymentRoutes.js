const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();
const { PAYMONGO_SECRET_KEY, PAYMONGO_WEBHOOK_SECRET } = process.env;
const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  CustomCakeOrder,
  ImageBasedOrder,
  MenuItem,
  ItemSize,
} = require("../models");
const sequelize = require("../config/database");
const verifyToken = require("../middleware/verifyToken");

// Helper function to verify webhook signatures
const verifyWebhookSignature = (signature, payload, secret) => {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return signature === hmac.digest("hex");
};

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

// /api/payment/create-gcash-source for both normal and custom cake orders
router.post("/create-gcash-source", verifyToken, async (req, res) => {
  try {
    const {
      amount,
      description,
      items,
      redirect,
      customCakeId,
      isImageOrder,
      deliveryDate,
      delivery_method,
      delivery_address,
      customerInfo,
      isDownpayment,
    } = req.body;

    console.log("Create GCash Payment Request:", {
      customCakeId,
      isImageOrder,
      isDownpayment,
      delivery_method,
      delivery_address,
      deliveryDate,
      amount,
    });

    // Validate required fields
    if (!amount || !redirect?.success || !redirect?.failed) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields (amount, redirect URLs)",
      });
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than zero",
      });
    }
    if (amount < 2000) {
      return res.status(400).json({
        success: false,
        error: "GCash payments require a minimum amount of Php 20.00",
      });
    }

    const isCustom = !!customCakeId;

    // For custom orders, validate the custom cake exists and is ready for payment
    if (isCustom) {
      let customOrder;
      if (isImageOrder) {
        customOrder = await ImageBasedOrder.findOne({
          where: {
            imageBasedOrderId: customCakeId,
            userID: req.user.userID,
          },
        });

        if (isDownpayment && customOrder?.status !== "Ready for Downpayment") {
          return res.status(400).json({
            success: false,
            error: `Image-based order not ready for downpayment. Current status: ${
              customOrder?.status || "Not found"
            }`,
          });
        }

        if (!isDownpayment && customOrder?.status !== "Downpayment Paid") {
          return res.status(400).json({
            success: false,
            error: `Image-based order requires downpayment first. Current status: ${
              customOrder?.status || "Not found"
            }`,
          });
        }
      } else {
        customOrder = await CustomCakeOrder.findOne({
          where: {
            customCakeId: customCakeId,
            userID: req.user.userID,
          },
        });

        // Accept "Pending Payment" status for 3D cakes
        const validDownpaymentStatuses = [
          "Pending Payment",
          "Ready for Downpayment",
        ];

        if (
          isDownpayment &&
          !validDownpaymentStatuses.includes(customOrder?.status)
        ) {
          return res.status(400).json({
            success: false,
            error: `Custom cake order not ready for downpayment. Current status: ${
              customOrder?.status || "Not found"
            }`,
          });
        }

        if (!isDownpayment && customOrder?.status !== "Downpayment Paid") {
          return res.status(400).json({
            success: false,
            error: `Custom cake order requires downpayment first. Current status: ${
              customOrder?.status || "Not found"
            }`,
          });
        }
      }

      // Validate downpayment amount
      if (isDownpayment) {
        const expectedDownpayment =
          customOrder.downpayment_amount || customOrder.price * 0.5;
        const receivedAmount = amount / 100;

        if (Math.abs(receivedAmount - expectedDownpayment) > 0.01) {
          return res.status(400).json({
            success: false,
            error: `Downpayment amount mismatch. Expected: ₱${expectedDownpayment.toFixed(
              2
            )}, Received: ₱${receivedAmount.toFixed(2)}`,
          });
        }
      }
    }

    // Create Paymongo payment link with proper metadata
    const paymongoPayload = {
      data: {
        attributes: {
          amount: Math.round(amount),
          description:
            description ||
            (isCustom
              ? `Custom Cake ${isDownpayment ? "Downpayment" : "Order"}`
              : "Regular Order"),
          remarks: isCustom
            ? `Custom Cake ${
                isDownpayment ? "Downpayment" : "Full Payment"
              } for user ${req.user.userID}`
            : `Order for user ${req.user.userID}`,
          currency: "PHP",
          checkout: {
            name: customerInfo?.fullName || req.user.name || "Customer",
            email: customerInfo?.email || req.user.email,
          },
          redirect: {
            success: redirect.success,
            failed: redirect.failed,
          },
          payment_method_allowed: ["gcash"],
          metadata: {
            userId: req.user.userID,
            deliveryDate: deliveryDate
              ? new Date(deliveryDate).toISOString()
              : null,
            delivery_method: delivery_method || "pickup", // ✅ Underscore notation
            delivery_address:
              delivery_method === "delivery" ? delivery_address : null, // ✅ Underscore notation
            isDownpayment: isDownpayment || false,
            ...(isCustom && {
              customCakeId,
              isImageOrder,
              orderType: isImageOrder ? "image_based_cake" : "custom_3d_cake",
            }),
            ...(!isCustom && {
              items,
              orderType: "regular_order",
            }),
            system: "Slice N Grind",
          },
        },
      },
    };

    console.log(
      "PayMongo Payload Metadata:",
      paymongoPayload.data.attributes.metadata
    );

    const paymongoResponse = await axios.post(
      "https://api.paymongo.com/v1/links",
      paymongoPayload,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            PAYMONGO_SECRET_KEY + ":"
          ).toString("base64")}`,
          "Content-Type": "application/json",
        },
        timeout: 10000,
      }
    );

    const paymentLink = paymongoResponse.data.data;
    const checkoutUrl = paymentLink.attributes.checkout_url;

    console.log("Payment link created:", {
      paymentLinkId: paymentLink.id,
      amount: (amount / 100).toFixed(2),
      checkoutUrl,
      userId: req.user.userID,
      isCustom,
      isDownpayment: isDownpayment || false,
      delivery_method: delivery_method || "pickup",
      delivery_address: delivery_address || null,
      deliveryDate: deliveryDate ? new Date(deliveryDate).toISOString() : null,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      checkoutUrl,
      paymentId: paymentLink.id,
      sandboxNote:
        process.env.NODE_ENV === "development"
          ? "Use test GCash number 9051111111 for successful payment"
          : undefined,
    });
  } catch (error) {
    console.error("Paymongo GCash Error:", error.message);

    let statusCode = 500;
    let errorMessage = "Payment processing failed";

    if (error.response) {
      statusCode = error.response.status || 500;
      errorMessage = error.response.data?.errors?.[0]?.detail || errorMessage;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/orders/verify-gcash-payment - Verify and create/update order after GCash payment
router.post("/verify-gcash-payment", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { paymentId, orderData } = req.body;

    // Check if order already exists (created by webhook)
    let order = await Order.findOne({
      where: { payment_id: paymentId },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
        },
      ],
      transaction,
    });

    if (order) {
      // Order already created by webhook, just return it
      await transaction.commit();
      return res.json({
        success: true,
        order,
        message: "Order already processed",
      });
    }

    // If webhook hasn't processed yet, create the order
    order = await Order.create(
      {
        userID: req.user.userID,
        total_amount: orderData.totalAmount,
        status: "processing",
        payment_id: paymentId,
        payment_verified: true,
        payment_method: "gcash",
        delivery_method: orderData.deliveryMethod,
        pickup_date: orderData.pickupDate, // FIXED: Include pickup_date
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

    // Create order items
    if (orderData.items && orderData.items.length > 0) {
      await OrderItem.bulkCreate(
        orderData.items.map((item) => ({
          orderId: order.orderId,
          menuId: item.menuId,
          sizeId: item.sizeId,
          quantity: item.quantity,
          price: item.price,
          item_name: item.name,
          size_name: item.size,
        })),
        { transaction }
      );
    }

    // Clear the user's cart
    const cart = await Cart.findOne({
      where: { userID: req.user.userID },
      transaction,
    });

    if (cart) {
      await CartItem.destroy({
        where: { cartId: cart.cartId },
        transaction,
      });
    }

    await transaction.commit();

    res.json({
      success: true,
      order,
      message: "Order created successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Order verification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify order",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/payment/verify-custom-cake-payment - Verify GCash payment for custom cakes
router.post("/verify-custom-cake-payment", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { paymentId, customCakeData } = req.body;

    console.log("Verifying custom cake final payment:", {
      paymentId,
      customCakeData,
    });

    // Verify payment with Paymongo
    const verifyResponse = await axios.get(
      `https://api.paymongo.com/v1/links/${paymentId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            PAYMONGO_SECRET_KEY + ":"
          ).toString("base64")}`,
        },
        timeout: 5000,
      }
    );

    const paymentData = verifyResponse.data.data;
    if (paymentData.attributes.status !== "paid") {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Payment not completed" });
    }

    const {
      customCakeId,
      isImageOrder,
      deliveryDate,
      delivery_method, // ✅ Underscore from frontend
      customerInfo,
      totalAmount,
      delivery_address, // ✅ Underscore from frontend
    } = customCakeData;

    console.log("Processing custom cake final payment with data:", {
      customCakeId,
      isImageOrder,
      deliveryDate,
      delivery_method,
      delivery_address,
      totalAmount,
    });

    // Build update data object
    const updateData = {
      status: "In Progress",
      payment_status: "paid",
      final_payment_status: "paid",
      delivery_method: delivery_method || "pickup", // ✅ Save to model
      delivery_address:
        delivery_method === "delivery" ? delivery_address : null, // ✅ Save to model
    };

    // Add delivery date if provided
    if (deliveryDate) {
      const parsedDate = new Date(deliveryDate);
      if (!isNaN(parsedDate.getTime())) {
        updateData.deliveryDate = parsedDate;
      }
    }

    console.log("Final payment update data:", updateData);

    // Update the appropriate table
    let customOrder;
    if (isImageOrder) {
      customOrder = await ImageBasedOrder.findByPk(customCakeId, {
        transaction,
      });
      if (!customOrder) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ success: false, error: "Image-based order not found" });
      }
      await customOrder.update(updateData, { transaction });
      console.log("Image-based order updated:", customOrder.imageBasedOrderId);
    } else {
      customOrder = await CustomCakeOrder.findByPk(customCakeId, {
        transaction,
      });
      if (!customOrder) {
        await transaction.rollback();
        return res
          .status(404)
          .json({ success: false, error: "Custom cake order not found" });
      }
      await customOrder.update(updateData, { transaction });
      console.log("Custom cake order updated:", customOrder.customCakeId);
    }

    // Create Order record for final payment
    const order = await Order.create(
      {
        userID: req.user.userID,
        total_amount: totalAmount,
        status: "processing",
        payment_id: paymentId,
        payment_verified: true,
        payment_method: "gcash",
        delivery_method: delivery_method || "pickup", // ✅ Save to Order table
        pickup_date: customOrder.deliveryDate,
        customer_name: customerInfo.fullName,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        delivery_address:
          delivery_method === "delivery" ? delivery_address : null, // ✅ Save to Order table
        items: [
          {
            customCakeId,
            name: isImageOrder ? "Custom Image Cake" : "3D Custom Cake",
            price: totalAmount,
            quantity: 1,
            size: customOrder.size || "Custom",
          },
        ],
      },
      { transaction }
    );

    // Create OrderItem for final payment
    const orderItemData = {
      orderId: order.orderId,
      quantity: 1,
      price: totalAmount,
      item_name: isImageOrder ? "Custom Image Cake" : "3D Custom Cake",
      size_name: customOrder.size || "Custom",
    };

    if (isImageOrder) {
      orderItemData.imageOrderId = customCakeId;
    } else {
      orderItemData.customCakeId = customCakeId;
    }

    await OrderItem.create(orderItemData, { transaction });

    // Clear user cart
    const cart = await Cart.findOne({
      where: { userID: req.user.userID },
      transaction,
    });
    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Custom cake final payment verified and order created",
      order,
      customOrder,
      savedData: {
        delivery_method: customOrder.delivery_method,
        delivery_address: customOrder.delivery_address,
        deliveryDate: customOrder.deliveryDate,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Custom cake verification failed:", error);
    res.status(500).json({
      success: false,
      error: "Verification failed: " + error.message,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// POST /api/payment/webhook - Handle Paymongo webhooks (SINGLE UPDATED VERSION)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let transaction;
    try {
      const signature = req.headers["paymongo-signature"];
      const payload = req.body.toString();

      // Verify signature in production
      if (process.env.NODE_ENV === "production") {
        if (
          !verifyWebhookSignature(signature, payload, PAYMONGO_WEBHOOK_SECRET)
        ) {
          console.warn("Invalid webhook signature");
          return res.status(401).send("Invalid signature");
        }
      }

      const event = JSON.parse(payload);
      console.log("Received Paymongo webhook:", event.data.type);

      if (event.data.type === "payment.paid") {
        transaction = await sequelize.transaction();
        const payment = event.data.attributes;
        const metadata = payment.metadata || {};
        const paymentId = payment.data?.id || payment.id;
        const userId = metadata.userId;

        console.log("Processing webhook payment:", {
          paymentId,
          userId,
          metadata,
          amount: payment.amount,
        });

        // HANDLE CUSTOM CAKE ORDERS
        if (metadata.customCakeId) {
          const {
            customCakeId,
            isImageOrder,
            deliveryDate,
            isDownpayment,
            delivery_method,
            delivery_address,
          } = metadata;

          console.log("Processing custom cake webhook:", {
            customCakeId,
            isImageOrder,
            isDownpayment,
            delivery_method,
            delivery_address,
            amount: payment.amount,
          });

          // Build update data
          let updateData = {
            delivery_method: delivery_method || "pickup",
            delivery_address:
              delivery_method === "delivery" ? delivery_address : null,
          };

          if (isDownpayment) {
            //Handle both "Pending Payment" and "Ready for Downpayment" → "Downpayment Paid"
            updateData.status = "Downpayment Paid";
            updateData.payment_status = "pending";
            updateData.is_downpayment_paid = true;
            updateData.downpayment_paid_at = new Date();
          } else {
            //Final payment received
            updateData.status = "In Progress";
            updateData.payment_status = "paid";
            updateData.final_payment_status = "paid";
          }

          //Set delivery date if provided
          if (
            deliveryDate &&
            deliveryDate !== "null" &&
            deliveryDate !== "undefined"
          ) {
            const parsedDate = new Date(deliveryDate);
            if (!isNaN(parsedDate.getTime())) {
              updateData.deliveryDate = parsedDate;
            }
          }

          console.log("Webhook update data:", updateData);

          //Update the appropriate table
          let customOrder;
          if (isImageOrder) {
            customOrder = await ImageBasedOrder.findByPk(customCakeId, {
              transaction,
            });
            if (!customOrder) {
              console.error(`Image-based order ${customCakeId} not found`);
              await transaction.rollback();
              return res.status(404).json({ error: "Order not found" });
            }
            await customOrder.update(updateData, { transaction });
            console.log(
              `Image-based order ${customCakeId} updated via webhook:`,
              {
                previousStatus: customOrder.status,
                newStatus: updateData.status,
              }
            );
          } else {
            customOrder = await CustomCakeOrder.findByPk(customCakeId, {
              transaction,
            });
            if (!customOrder) {
              console.error(`Custom cake order ${customCakeId} not found`);
              await transaction.rollback();
              return res.status(404).json({ error: "Order not found" });
            }
            await customOrder.update(updateData, { transaction });
            console.log(
              `Custom cake order ${customCakeId} updated via webhook:`,
              {
                previousStatus: customOrder.status,
                newStatus: updateData.status,
              }
            );
          }

          //Create Order record ONLY for final payment
          if (!isDownpayment) {
            const order = await Order.create(
              {
                userID: userId,
                total_amount: payment.amount / 100,
                status: "processing",
                payment_id: paymentId,
                payment_verified: true,
                payment_method: "gcash",
                delivery_method: delivery_method || "pickup",
                delivery_address:
                  delivery_method === "delivery" ? delivery_address : null,
                customer_name: payment.checkout?.name || "Customer",
                customer_email: payment.checkout?.email,
                customer_phone: payment.checkout?.phone || "Not provided",
                items: [],
              },
              { transaction }
            );

            await OrderItem.create(
              {
                orderId: order.orderId,
                customCakeId: isImageOrder ? null : customCakeId,
                imageOrderId: isImageOrder ? customCakeId : null,
                quantity: 1,
                price: payment.amount / 100,
                item_name: isImageOrder
                  ? "Custom Image Cake"
                  : "3D Custom Cake",
                size_name: metadata.size || "Custom",
              },
              { transaction }
            );

            console.log(
              `Order ${order.orderId} created for final payment via webhook`
            );
          }

          await transaction.commit();
          return res.status(200).end();
        } else {
          //Handle regular orders
          let order = await Order.findOne({
            where: { payment_id: paymentId },
            transaction,
          });

          if (order && order.payment_verified) {
            console.log(`Payment ${paymentId} already processed, skipping`);
            await transaction.commit();
            return res.status(200).end();
          }

          const items = metadata.items || [];
          const deliveryDate = metadata.deliveryDate;
          const deliveryMethod = metadata.deliveryMethod || "pickup";

          if (!order) {
            const orderData = {
              userID: userId,
              total_amount: payment.amount / 100,
              status: "processing",
              payment_id: paymentId,
              payment_verified: true,
              payment_method: "gcash",
              delivery_method: deliveryMethod,
              customer_name: payment.checkout?.name || "Customer",
              customer_email: payment.checkout?.email,
              customer_phone: payment.checkout?.phone || "Not provided",
              delivery_address: items[0]?.customerInfo?.deliveryAddress || null,
              items: items,
            };

            if (
              deliveryDate &&
              deliveryDate !== "null" &&
              deliveryDate !== "undefined"
            ) {
              const parsedDate = new Date(deliveryDate);
              if (!isNaN(parsedDate.getTime())) {
                orderData.pickup_date = parsedDate;
              }
            }

            order = await Order.create(orderData, { transaction });

            if (items.length > 0) {
              await OrderItem.bulkCreate(
                items.map((item) => ({
                  orderId: order.orderId,
                  menuId: item.menuId,
                  sizeId: item.sizeId,
                  quantity: item.quantity,
                  price: item.price,
                  item_name: item.name,
                  size_name: item.size,
                })),
                { transaction }
              );
            }
          } else {
            await order.update(
              {
                status: "processing",
                payment_verified: true,
              },
              { transaction }
            );
          }

          // Clear user cart
          if (userId) {
            const cart = await Cart.findOne({
              where: { userID: userId },
              transaction,
            });

            if (cart) {
              await CartItem.destroy({
                where: { cartId: cart.cartId },
                transaction,
              });
            }
          }

          await transaction.commit();
          return res.status(200).end();
        }
      }

      res.status(200).end();
    } catch (error) {
      console.error("Webhook processing error:", error);
      if (transaction) await transaction.rollback();
      return res.status(200).json({ success: false });
    }
  }
);

//GET /api/payment/verify/:orderId - Verify payment status and update order if needed
router.get("/verify/:orderId", verifyToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    //Get the order with items
    const order = await Order.findOne({
      where: {
        orderId,
        userID: req.user.userID,
      },
      include: [
        {
          model: OrderItem,
          as: "orderItems",
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    //For cash payments, just return current status
    if (order.payment_method === "cash") {
      return res.json({
        success: true,
        status: order.status,
        isPaid: order.status === "completed",
        order,
      });
    }

    //For GCash payments, verify with Paymongo
    if (!order.payment_id) {
      return res.status(400).json({
        success: false,
        error: "No payment associated with this order",
      });
    }

    const response = await axios.get(
      `https://api.paymongo.com/v1/links/${order.payment_id}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            PAYMONGO_SECRET_KEY + ":"
          ).toString("base64")}`,
        },
        timeout: 5000,
      }
    );

    const paymentData = response.data.data;
    const paymentStatus = paymentData.attributes.status;
    const isPaid = paymentStatus === "paid";

    //Validate currency
    if (paymentData.attributes.currency !== "PHP") {
      throw new Error("Invalid currency");
    }

    //Update order status if paid and not yet verified
    if (isPaid && order.status === "pending_payment") {
      await order.update({
        status: "processing",
        payment_verified: true,
      });
    }

    res.json({
      success: true,
      status: paymentStatus,
      isPaid,
      paidAt: paymentData.attributes.paid_at,
      amount: paymentData.attributes.amount / 100,
      currency: paymentData.attributes.currency,
      paymentMethod:
        paymentData.attributes.payments[0]?.source?.type || "gcash",
      order,
    });
  } catch (error) {
    console.error("Payment verification failed:", error);

    let statusCode = 500;
    let errorMessage = "Payment verification failed";

    if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = "Payment not found";
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? error.response?.data?.errors || error.message
          : undefined,
    });
  }
});

router.post("/process-cash-order", verifyToken, async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { items, deliveryMethod, pickupDate, customerInfo, totalAmount } =
      req.body;

    if (!items || items.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, error: "Items are required for cash orders" });
    }

    if (!totalAmount || totalAmount <= 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, error: "Valid total amount is required" });
    }

    const order = await Order.create(
      {
        userID: req.user.userID,
        total_amount: totalAmount,
        status: "pending",
        payment_method: "cash",
        payment_verified: false,
        delivery_method: deliveryMethod || "pickup",
        pickup_date: pickupDate ? new Date(pickupDate) : null,
        customer_name: customerInfo?.fullName || req.user.name || "Customer",
        customer_email: customerInfo?.email || req.user.email,
        customer_phone: customerInfo?.phone || "Not provided",
        delivery_address:
          deliveryMethod === "delivery" ? customerInfo?.deliveryAddress : null,
        items: items,
      },
      { transaction }
    );

    //Call createOrderItems to reduce stock
    await createOrderItems(order.orderId, items, transaction);

    // Clear the user's cart
    const cart = await Cart.findOne({
      where: { userID: req.user.userID },
      transaction,
    });

    if (cart) {
      await CartItem.destroy({ where: { cartId: cart.cartId }, transaction });
    }

    await transaction.commit();

    console.log(`Cash order created successfully: ${order.orderId}`);

    res.json({
      success: true,
      order,
      message: "Cash order placed successfully. Please wait for confirmation.",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Cash order processing error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process cash order",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// GET /api/payment/verify-payment/:paymentId - Verify payment status by payment ID
router.get("/verify-payment/:paymentId", verifyToken, async (req, res) => {
  try {
    const { paymentId } = req.params;

    const response = await axios.get(
      `https://api.paymongo.com/v1/links/${paymentId}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            PAYMONGO_SECRET_KEY + ":"
          ).toString("base64")}`,
        },
        timeout: 5000,
      }
    );

    const paymentData = response.data.data;
    const paymentStatus = paymentData.attributes.status;
    const isPaid = paymentStatus === "paid";

    if (paymentData.attributes.currency !== "PHP") {
      throw new Error("Invalid currency");
    }

    res.json({
      success: true,
      status: paymentStatus,
      isPaid,
      paidAt: paymentData.attributes.paid_at,
      amount: paymentData.attributes.amount / 100,
      currency: paymentData.attributes.currency,
      paymentMethod:
        paymentData.attributes.payments[0]?.source?.type || "gcash",
    });
  } catch (error) {
    console.error("Payment verification failed:", error);

    let statusCode = 500;
    let errorMessage = "Payment verification failed";

    if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = "Payment not found";
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? error.response?.data?.errors || error.message
          : undefined,
    });
  }
});

// POST /api/payment/verify-custom-cake-downpayment - Verify downpayment for custom cakes
router.post(
  "/verify-custom-cake-downpayment",
  verifyToken,
  async (req, res) => {
    const transaction = await sequelize.transaction();

    try {
      const { paymentId, customCakeData } = req.body;

      console.log("Verifying custom cake downpayment:", {
        paymentId,
        customCakeData,
      });

      // Verify payment with Paymongo
      const verifyResponse = await axios.get(
        `https://api.paymongo.com/v1/links/${paymentId}`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(
              PAYMONGO_SECRET_KEY + ":"
            ).toString("base64")}`,
          },
          timeout: 5000,
        }
      );

      const paymentData = verifyResponse.data.data;
      if (paymentData.attributes.status !== "paid") {
        await transaction.rollback();
        return res
          .status(400)
          .json({ success: false, message: "Downpayment not completed" });
      }

      const {
        customCakeId,
        isImageOrder,
        deliveryDate,
        delivery_method,
        customerInfo,
        downpaymentAmount,
        delivery_address,
      } = customCakeData;

      console.log("Processing custom cake downpayment with data:", {
        customCakeId,
        isImageOrder,
        deliveryDate,
        delivery_method,
        delivery_address,
        downpaymentAmount,
      });

      // Build update data object
      const updateData = {
        status: "Downpayment Paid",
        payment_status: "pending",
        is_downpayment_paid: true,
        downpayment_paid_at: new Date(),
        downpayment_amount: downpaymentAmount,
        delivery_method: delivery_method || "pickup",
        delivery_address:
          delivery_method === "delivery" ? delivery_address : null,
      };

      // Add delivery date if provided
      if (deliveryDate) {
        const parsedDate = new Date(deliveryDate);
        if (!isNaN(parsedDate.getTime())) {
          updateData.deliveryDate = parsedDate;
        }
      }

      console.log("Update data to be saved:", updateData);

      // Update the appropriate table
      let customOrder;
      if (isImageOrder) {
        customOrder = await ImageBasedOrder.findByPk(customCakeId, {
          transaction,
        });
        if (!customOrder) {
          await transaction.rollback();
          return res
            .status(404)
            .json({ success: false, error: "Image-based order not found" });
        }
        await customOrder.update(updateData, { transaction });
        console.log(
          "Image-based order updated:",
          customOrder.imageBasedOrderId
        );
      } else {
        customOrder = await CustomCakeOrder.findByPk(customCakeId, {
          transaction,
        });
        if (!customOrder) {
          await transaction.rollback();
          return res
            .status(404)
            .json({ success: false, error: "Custom cake order not found" });
        }
        await customOrder.update(updateData, { transaction });
        console.log("Custom cake order updated:", customOrder.customCakeId);
      }

      await transaction.commit();

      res.json({
        success: true,
        message: "Custom cake downpayment verified and saved",
        customOrder,
        savedData: {
          delivery_method: customOrder.delivery_method,
          delivery_address: customOrder.delivery_address,
          deliveryDate: customOrder.deliveryDate,
        },
        note: "Downpayment recorded. Final payment will be collected at pickup/delivery.",
      });
    } catch (error) {
      await transaction.rollback();
      console.error("Custom cake downpayment verification failed:", error);
      res.status(500).json({
        success: false,
        error: "Downpayment verification failed: " + error.message,
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

module.exports = router;
