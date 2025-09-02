/**
 * For handling cart-related API endpoints.
 * 
 */
// Import required dependencies
const express = require('express');
const router = express.Router();
const { MenuItem, ItemSize } = require('../models'); 
const multer = require('multer'); 
const path = require('path'); 
const verifyToken = require('../middleware/verifyToken'); 

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: './uploads/', // Set upload directory
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage }); // Initialize Multer with storage configuration

// POST /api/menu - route to create a new menu item
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { name, category, description, stock, hasSizes, basePrice, sizes } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Create menu item - stock only matters if no sizes
    const menuItem = await MenuItem.create({
      name,
      category,
      description,
      image,
      stock: hasSizes === 'true' ? 0 : parseInt(stock || 0), // Use 0 if no stock provided for sized items
      isActive: true,
      hasSizes: hasSizes === 'true',
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice || 0)
    });

    // Handle sizes if needed
    if (hasSizes === 'true') {
      const parsedSizes = JSON.parse(sizes || '[]');
      if (parsedSizes.length > 0) {
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: menuItem.menuId,
            sizeName: size.sizeName,
            price: parseFloat(size.price || 0),
            stock: parseInt(size.stock || 0), // Default to 0 if no stock provided
            isActive: true
          }))
        );
      }
    }

    // Fetch and return the created item
    const result = await MenuItem.findByPk(menuItem.menuId, {
      include: [{
        model: ItemSize,
        as: 'sizes',
        attributes: ['sizeId', 'sizeName', 'price', 'stock'], // Include stock in response
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

// PUT route to update an existing menu item
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params; // Get item ID from URL
    const { name, category, description, stock, hasSizes, basePrice, sizes } = req.body; // Extract form data
    // Use uploaded image or retain existing one
    const image = req.file ? `/uploads/${req.file.filename}` : req.body.image;

    // Find menu item by ID
    const menuItem = await MenuItem.findByPk(id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    // Update menu item details
    await menuItem.update({
      name,
      category,
      description,
      image,
      stock: hasSizes === 'true' ? 0 : parseInt(stock), // Convert stock to integer
      hasSizes: hasSizes === 'true', // Convert string to boolean
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice), // Set base price or default to 0
    });

    // Handle sizes update
    if (hasSizes === 'true') {
      await ItemSize.destroy({ where: { menuId: id } });
      const parsedSizes = JSON.parse(sizes || '[]');
      if (parsedSizes.length > 0) {
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: id,
            sizeName: size.sizeName,
            price: parseFloat(size.price),
            stock: parseInt(size.stock || stock), // Use size-specific stock or fallback
            isActive: true
          }))
        );
      }
    } else {
      // Remove all sizes if hasSizes is false
      await ItemSize.destroy({ where: { menuId: id } });
    }

    // Fetch updated item with sizes
    const result = await MenuItem.findByPk(id, {
      include: [{ model: ItemSize, as: 'sizes', where: { isActive: true }, required: false }],
    });
    res.json(result); // Return updated item
  } catch (error) {
    // Log and return error response
    console.error('Error updating menu item:', error);
    res.status(400).json({ error: 'Failed to update menu item' });
  }
});

// GET route to fetch all active menu items
router.get('/', async (req, res) => {
  try {
    // Fetch all active menu items with their sizes
    const menuItems = await MenuItem.findAll({ 
      where: { isActive: true }, // Only active items
      include: [{
        model: ItemSize,
        as: 'sizes',
        where: { isActive: true }, // Only active sizes
        required: false, // Include items without sizes
        attributes: ['sizeId', 'sizeName', 'price', 'stock'] // Select specific size fields
      }],
      raw: false // Return Sequelize instances
    });
    
    // Format response data
    const responseData = menuItems.map(item => ({
      ...item.get({ plain: true }), // Convert to plain object
      sizes: item.sizes?.map(size => size.get({ plain: true })) || [] // Convert sizes to plain objects
    }));
    
    res.json(responseData); // Return menu items
  } catch (error) {
    // Log and return error response
    console.error('Error fetching menu items:', error);
    res.status(500).json({ 
      error: 'Failed to fetch menu items',
      // Include error details in development mode
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET route to fetch a single menu item by ID
router.get('/:id', async (req, res) => {
  try {
    // Find menu item by ID with associated sizes
    const menuItem = await MenuItem.findByPk(req.params.id, {
      include: [{
        model: ItemSize,
        as: 'sizes',
        where: { isActive: true }, // Only active sizes
        required: false // Include even if no sizes
      }]
    });
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.json(menuItem); // Return menu item
  } catch (error) {
    // Log and return error response
    console.error('Error fetching menu item:', error);
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// DELETE route to soft delete a menu item
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Find menu item by ID
    const menuItem = await MenuItem.findByPk(req.params.id);
    if (!menuItem) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    // Soft delete by setting isActive to false
    await menuItem.update({ isActive: false });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    // Log and return error response
    console.error('Error deleting menu item:', error);
    res.status(400).json({ error: 'Failed to delete menu item' });
  }
});

// Export the router for use in the main application
module.exports = router;