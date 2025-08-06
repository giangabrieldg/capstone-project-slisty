// Import required dependencies
const express = require('express');
const router = express.Router();
const { MenuItem, ItemSize } = require('../models'); // Import database models
const multer = require('multer'); // Middleware for handling file uploads
const path = require('path'); // Utility for handling file paths
const verifyToken = require('../middleware/verifyToken'); // Middleware for JWT authentication

// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: './uploads/', // Set upload directory
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage }); // Initialize Multer with storage configuration

// POST route to create a new menu item
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    // Extract form data from request body
    const { name, category, description, stock, hasSizes, basePrice, sizes } = req.body;
    // Construct image path if file is uploaded
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Create new menu item in database
    const menuItem = await MenuItem.create({
      name,
      category,
      description,
      image,
      stock: parseInt(stock), // Convert stock to integer
      isActive: true, // Set item as active
      hasSizes: hasSizes === 'true', // Convert string to boolean
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice) // Set base price or default to 0 if sizes are used
    });

    // Handle sizes if item has multiple sizes
    if (hasSizes === 'true') {
      const parsedSizes = JSON.parse(sizes || '[]'); // Parse sizes JSON or default to empty array
      if (parsedSizes.length > 0) {
        // Bulk create size entries for the menu item
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: menuItem.menuId,
            sizeName: size.sizeName,
            price: parseFloat(size.price), // Convert price to float
            isActive: true // Set size as active
          }))
        );
      }
    }

    // Fetch created item with associated sizes
    const result = await MenuItem.findByPk(menuItem.menuId, {
      include: [{
        model: ItemSize,
        as: 'sizes',
        where: { isActive: true }, // Only include active sizes
        required: false // Include even if no sizes exist
      }]
    });

    // Return created item
    res.status(201).json(result);
  } catch (error) {
    // Log and return error response
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
      stock: parseInt(stock), // Convert stock to integer
      hasSizes: hasSizes === 'true', // Convert string to boolean
      basePrice: hasSizes === 'true' ? 0.00 : parseFloat(basePrice), // Set base price or default to 0
    });

    // Handle sizes update
    if (hasSizes === 'true') {
      // Remove existing sizes
      await ItemSize.destroy({ where: { menuId: id } });
      const parsedSizes = JSON.parse(sizes || '[]'); // Parse sizes JSON
      if (parsedSizes.length > 0) {
        // Create new size entries
        await ItemSize.bulkCreate(
          parsedSizes.map(size => ({
            menuId: id,
            sizeName: size.sizeName,
            price: parseFloat(size.price), // Convert price to float
            isActive: true // Set size as active
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
        attributes: ['sizeId', 'sizeName', 'price'] // Select specific size fields
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