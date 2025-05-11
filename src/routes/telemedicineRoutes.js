// src/routes/telemedicineRoutes.js
const express = require('express');
const router = express.Router();
const telemedicineController = require('../controllers/telemedicineController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Telemedicine Routes
 */

// Public route for Twilio webhook callback
router.post('/room-status-callback', telemedicineController.roomStatusCallback);

// Protected routes - require authentication
router.use(authenticate);

// Create a new telemedicine session
router.post(
  '/sessions', 
  authorize('doctor', 'admin'), 
  telemedicineController.createTelemedicineSession
);

// Get all telemedicine sessions for the current user
router.get(
  '/sessions', 
  authorize('doctor', 'patient', 'admin'), 
  telemedicineController.getTelemedicineSessions
);

// Get a telemedicine session by ID
router.get(
  '/sessions/:id', 
  authorize('doctor', 'patient', 'admin'), 
  telemedicineController.getTelemedicineSessionById
);

// Generate a token for joining a telemedicine session
router.post(
  '/token', 
  authorize('doctor', 'patient'), 
  telemedicineController.generateToken
);

// End a telemedicine session
router.put(
  '/sessions/:id/end', 
  authorize('doctor', 'admin'), 
  telemedicineController.endTelemedicineSession
);

// Submit patient feedback for a telemedicine session
router.post(
  '/sessions/:id/feedback', 
  authorize('patient'), 
  telemedicineController.submitFeedback
);

module.exports = router;