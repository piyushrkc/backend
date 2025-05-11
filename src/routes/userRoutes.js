// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Routes that don't require authentication
router.post('/', userController.createUser);

// All routes below this require authentication
router.use(authenticate);

// Get all users (admin only)
router.get('/', authorize('admin'), userController.getUsers);

// Get user by ID
router.get('/:id', userController.getUserById);

// Update user
router.put('/:id', userController.updateUser);

// Delete user (admin only)
router.delete('/:id', authorize('admin'), userController.deleteUser);

// Change password (user can only change their own password)
router.post('/change-password', userController.changePassword);

module.exports = router;