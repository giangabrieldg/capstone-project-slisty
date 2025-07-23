/**
 * Express router for handling menu item CRUD operations.
 * Supports image uploads and access control for certain routes.
 */

const express = require('express'); // Express framework for routing
const router = express.Router(); // Router instance for menu routes
const MenuItem = require('../models/menuItem'); // MenuItem model for DB operations
const { authenticate } = require('../middleware/menuAccessControl'); // Middleware for role-based authentication
const multer = require('multer'); // Middleware for handling multipart/form-data (file uploads)
const path = require('path'); // Node.js path module for handling file paths

// Configure multer storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Set upload destination folder
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Set filename as current timestamp + original file extension
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// Multer upload instance with file size limit and file type filter
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
  fileFilter: (req, file, cb) => {
    // Allow only image files with specific extensions
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, jpg, png, gif) are allowed'));
    }
  }
});

// GET /api/menu - Retrieve all menu items
router.get('/', async (req, res) => {
  try {
    const menuItems = await MenuItem.findAll();
    console.log('Fetched menu items:', menuItems.length);
    res.json(menuItems);
  } catch (error) {
    console.error('Error fetching menu items:', error.message, error.stack);
    res.status(500).json({ error: `Failed to fetch menu items: ${error.message}` });
  }
});

// GET /api/menu/:menuId - Retrieve a single menu item by ID
router.get('/:menuId', async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    res.json(menuItem);
  } catch (error) {
    console.error('Error fetching menu item:', error.message, error.stack);
    res.status(500).json({ error: `Failed to fetch menu item: ${error.message}` });
  }
});

// POST /api/menu - Create a new menu item (Admin and Staff only)
// Handles image upload for the menu item
router.post('/', authenticate(['Admin', 'Staff']), upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, sizes } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;
    console.log('POST /api/menu data:', { name, category, price, description, sizes, image });
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Missing required fields: name, category, or price' });
    }
    const menuItem = await MenuItem.create({ name, category, image, price: parseFloat(price), description, sizes });
    res.status(201).json(menuItem);
  } catch (error) {
    console.error('Error creating menu item:', error.message, error.stack);
    res.status(400).json({ error: `Failed to add menu item: ${error.message}` });
  }
});

// PUT /api/menu/:menuId - Update an existing menu item (Admin and Staff only)
// Handles image upload for updating the menu item image
router.put('/:menuId', authenticate(['Admin', 'Staff']), upload.single('image'), async (req, res) => {
  try {
    const { name, category, price, description, sizes } = req.body;
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    const image = req.file ? `/uploads/${req.file.filename}` : menuItem.image;
    console.log('PUT /api/menu data:', { name, category, price, description, sizes, image });
    await menuItem.update({ name, category, image, price: parseFloat(price), description, sizes });
    res.json(menuItem);
  } catch (error) {
    console.error('Error updating menu item:', error.message, error.stack);
    res.status(400).json({ error: `Failed to update menu item: ${error.message}` });
  }
});

// DELETE /api/menu/:menuId - Delete a menu item (Admin and Staff only)
router.delete('/:menuId', authenticate(['Admin', 'Staff']), async (req, res) => {
  try {
    const menuItem = await MenuItem.findByPk(req.params.menuId);
    if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });
    await menuItem.destroy();
    res.json({ message: 'Menu item deleted' });
  } catch (error) {
    console.error('Error deleting menu item:', error.message, error.stack);
    res.status(400).json({ error: `Failed to delete menu item: ${error.message}` });
  }
});

// Export the router to be used in the main app
module.exports = router;
