//For handling menu-related API endpoints.

const express = require("express");
const router = express.Router();
const { MenuItem, ItemSize } = require("../models");
const multer = require("multer");
const verifyToken = require("../middleware/verifyToken");
const checkDriveAuth = require("../middleware/driveAuth");
const googleDriveService = require("../utils/googleDrive");
require("dotenv").config();

//Multer memory storage
const upload = multer({ storage: multer.memoryStorage() });

//POST /api/menu
router.post(
  "/",
  verifyToken,
  upload.single("image"),
  checkDriveAuth,
  async (req, res) => {
    try {
      const { name, category, description, stock, hasSizes, basePrice, sizes } =
        req.body;
      let imageUrl = null;

      //Upload image to Google Drive
      if (req.file) {
        imageUrl = await googleDriveService.uploadImage(req.file);
      }

      //Create menu item
      const menuItem = await MenuItem.create({
        name,
        category,
        description,
        image: imageUrl,
        stock: hasSizes === "true" ? 0 : parseInt(stock || 0),
        isActive: true,
        hasSizes: hasSizes === "true",
        basePrice: hasSizes === "true" ? 0.0 : parseFloat(basePrice || 0),
      });

      //Handle sizes
      if (hasSizes === "true") {
        const parsedSizes = JSON.parse(sizes || "[]");
        if (parsedSizes.length > 0) {
          await ItemSize.bulkCreate(
            parsedSizes.map((size) => ({
              menuId: menuItem.menuId,
              sizeName: size.sizeName,
              price: parseFloat(size.price || 0),
              stock: parseInt(size.stock || 0),
              isActive: true,
            }))
          );
        }
      }

      //Fetch created item with sizes
      const result = await MenuItem.findByPk(menuItem.menuId, {
        include: [
          {
            model: ItemSize,
            as: "sizes",
            attributes: ["sizeId", "sizeName", "price", "stock"],
            where: { isActive: true },
            required: false,
          },
        ],
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating menu item:", error);
      res.status(400).json({
        error: "Failed to create menu item",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

//PUT /api/menu/:id
router.put(
  "/:id",
  verifyToken,
  upload.single("image"),
  checkDriveAuth,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, category, description, stock, hasSizes, basePrice, sizes } =
        req.body;
      let imageUrl = req.body.image;

      //Find menu item
      const menuItem = await MenuItem.findByPk(id);
      if (!menuItem) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      //Upload new image if provided
      if (req.file) {
        //Delete old image from Google Drive if exists
        if (menuItem.image) {
          await googleDriveService.deleteFile(menuItem.image);
        }

        //Upload new image
        imageUrl = await googleDriveService.uploadImage(req.file);
      }

      //Update menu item
      await menuItem.update({
        name,
        category,
        description,
        image: imageUrl,
        stock: hasSizes === "true" ? 0 : parseInt(stock || 0),
        hasSizes: hasSizes === "true",
        basePrice: hasSizes === "true" ? 0.0 : parseFloat(basePrice || 0),
      });

      //Handle sizes
      if (hasSizes === "true") {
        await ItemSize.destroy({ where: { menuId: id } });
        const parsedSizes = JSON.parse(sizes || "[]");
        if (parsedSizes.length > 0) {
          await ItemSize.bulkCreate(
            parsedSizes.map((size) => ({
              menuId: id,
              sizeName: size.sizeName,
              price: parseFloat(size.price || 0),
              stock: parseInt(size.stock || 0),
              isActive: true,
            }))
          );
        }
      } else {
        await ItemSize.destroy({ where: { menuId: id } });
      }

      //Fetch updated item
      const result = await MenuItem.findByPk(id, {
        include: [
          {
            model: ItemSize,
            as: "sizes",
            where: { isActive: true },
            required: false,
          },
        ],
      });

      res.json(result);
    } catch (error) {
      console.error("Error updating menu item:", error);
      res.status(400).json({
        error: "Failed to update menu item",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

//GET /api/menu
router.get("/", async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({
      where: { isActive: true },
      include: [
        {
          model: ItemSize,
          as: "sizes",
          where: { isActive: true },
          required: false,
          attributes: ["sizeId", "sizeName", "price", "stock"],
        },
      ],
      raw: false,
    });

    const responseData = menuItems.map((item) => ({
      ...item.get({ plain: true }),
      sizes: item.sizes?.map((size) => size.get({ plain: true })) || [],
    }));

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching menu items:", error);
    res.status(500).json({
      error: "Failed to fetch menu items",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

//GET /api/menu/:id
router.get("/:id", async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id, {
      include: [
        {
          model: ItemSize,
          as: "sizes",
          where: { isActive: true },
          required: false,
        },
      ],
    });
    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    res.json(menuItem);
  } catch (error) {
    console.error("Error fetching menu item:", error);
    res.status(500).json({ error: "Failed to fetch menu item" });
  }
});

//DELETE /api/menu/:id
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: "Menu item not found" });
    }
    await menuItem.update({ isActive: false });
    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Error deleting menu item:", error);
    res.status(400).json({ error: "Failed to delete menu item" });
  }
});

module.exports = router;
