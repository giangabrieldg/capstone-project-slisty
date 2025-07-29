const express = require('express');
const router = express.Router();
const MenuItem = require('../models/menu-item-model');
const { authenticate } = require('../middleware/menuAccessControl');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'));
    }
  },
});

router.get('/', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const whereClause = includeInactive ? {} : { isActive: true };
    const menuItems = await MenuItem.findAll({ where: whereClause });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch menu items: ${error.message}` });
  }
});

router.get('/:menuId', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    res.json(menuItem);
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch menu item: ${error.message}` });
  }
});

router.post('/', authenticate(['Admin', 'Staff']), upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Missing required fields: name, category, or price' });
    }
    let priceToStore;
    if (category === 'Cakes') {
      try {
        JSON.parse(price); // Validate JSON
        priceToStore = price;
      } catch {
        return res.status(400).json({ error: 'Invalid price JSON format for cakes' });
      }
    } else {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'Invalid price value' });
      }
      priceToStore = parsedPrice.toFixed(2);
    }
    const menuItem = await MenuItem.create({ name, category, image, price: priceToStore, description });
    res.status(201).json(menuItem);
  } catch (error) {
    res.status(400).json({ error: `Failed to add menu item: ${error.message}` });
  }
});

router.put('/:menuId', authenticate(['Admin', 'Staff']), upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description } = req.body;
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    const image = req.file ? `/uploads/${req.file.filename}` : menuItem.image;
    let priceToStore;
    if (category === 'Cakes') {
      try {
        JSON.parse(price); // Validate JSON
        priceToStore = price;
      } catch {
        return res.status(400).json({ error: 'Invalid price JSON format for cakes' });
      }
    } else {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice)) {
        return res.status(400).json({ error: 'Invalid price value' });
      }
      priceToStore = parsedPrice.toFixed(2);
    }
    await menuItem.update({ name, category, image, price: priceToStore, description });
    res.json(menuItem);
  } catch (error) {
    res.status(400).json({ error: `Failed to update menu item: ${error.message}` });
  }
});

router.delete('/:menuId', authenticate(['Admin', 'Staff']), async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    await menuItem.update({ isActive: false });
    res.json({ message: 'Menu item marked as inactive (soft deleted)' });
  } catch (error) {
    res.status(400).json({ error: `Failed to delete menu item: ${error.message}` });
  }
});

module.exports = router;