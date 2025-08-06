const express = require('express');
const router = express.Router();
const { MenuItem, ItemSize } = require('../models'); // Import from models/index.js
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
    const { name, category, description, stock, hasSizes, basePrice, sizes } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Create the menu item
    const menuItem = await MenuItem.create({
      name,
      category,
      description,
      image,
      stock: parseInt(stock),
      isActive: true,
      hasSizes: hasSizes === 'true',
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice)
    });

    // If it has sizes, create the size entries
    if (hasSizes === 'true') {
      const parsedSizes = JSON.parse(sizes || '[]');
      if (parsedSizes.length > 0) {
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: menuItem.menuId,
            sizeName: size.sizeName,
            price: parseFloat(size.price),
            isActive: true
          }))
        );
      }
    }

    // Return the menu item with its sizes
    const result = await MenuItem.findByPk(menuItem.menuId, {
      include: [{
        model: ItemSize,
        as: 'sizes',
        where: { isActive: true },
        required: false
      }]
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(400).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/menu/:id - Update a menu item
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, description, stock, hasSizes, basePrice, sizes } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;

    const menuItem = await MenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Update menu item
    await menuItem.update({
      name,
      category,
      description,
      image,
      stock: parseInt(stock),
      hasSizes: hasSizes === 'true',
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice),
    });

    // Handle sizes
    if (hasSizes === 'true') {
      // Delete existing sizes
      await ItemSize.destroy({ where: { menuId: id } });
      // Create new sizes from JSON
      const parsedSizes = JSON.parse(sizes || '[]');
      if (parsedSizes.length > 0) {
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: id,
            sizeName: size.sizeName,
            price: parseFloat(size.price),
            isActive: true,
          }))
        );
      }
    } else {
      // Clear sizes if hasSizes is false
      await ItemSize.destroy({ where: { menuId: id } });
    }

    // Return updated item with sizes
    const result = await MenuItem.findByPk(id, {
      include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
    });
    res.json(result);
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(400).json({ error: 'Failed to update menu item' });
  }
});

// GET /api/menu - Fetch all active menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll({ 
      where: { isActive: true },
      include: [{
        model: ItemSize,
        as: 'sizes',
        where: { isActive: true },
        required: false,
        attributes: ['sizeId', 'sizeName', 'price'] // Only include needed fields
      }],
      raw: false // Keep as false to maintain instance methods
    });
    
    // Convert to plain objects including nested sizes
    const responseData = menuItems.map(item => ({
      ...item.get({ plain: true }),
      sizes: item.sizes?.map(size => size.get({ plain: true })) || []
    }));
    
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch menu items',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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