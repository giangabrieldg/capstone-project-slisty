const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');
const { DataTypes } = require('sequelize');
const MenuItemModel = require('../models/menu-item-model');
const MenuItem = MenuItemModel(sequelize, DataTypes);
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middleware/verifyToken');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// POST /api/menu - Create a new menu item
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, stock } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    const menuItem = await MenuItem.create({
      name,
      category,
      price,
      description,
      image,
      stock: parseInt(stock), // Convert stock to integer
      isActive: true,
    });
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(400).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/menu/:id - Update a menu item
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, description, stock } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;
    const menuItem = await MenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    await menuItem.update({
      name,
      category,
      price,
      description,
      image,
      stock: parseInt(stock),
    });
    res.json(menuItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(400).json({ error: 'Failed to update menu item' });
  }
});

// GET /api/menu - Fetch all active menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({ where: { isActive: true } });
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
});

// GET /api/menu/:id - Fetch a single menu item
router.get('/:id', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(menuItem);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// DELETE /api/menu/:id - Soft delete a menu item
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    await menuItem.update({ isActive: false });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(400).json({ error: 'Failed to delete menu item' });
  }
});

module.exports = router;