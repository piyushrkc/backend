// src/routes/hospitalRoutes.js

const express = require('express');
const router = express.Router();
const hospitalController = require('../controllers/hospitalController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, validators } = require('../middleware/validation');
const { cache, invalidateCache } = require('../middleware/cache');
const config = require('../config/config');

// All routes require authentication
router.use(authenticate);

// Apply cache invalidation middleware for hospital-related routes
router.use(invalidateCache('hospital:*'));

// Get hospital details
router.get('/', 
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  hospitalController.getHospitalDetails
);

// Update hospital details (admin only)
router.put('/', 
  authorize('admin'), 
  hospitalController.updateHospitalDetails
);

// Update doctor details (admin or the doctor themselves)
router.put('/doctors/:id', 
  authorize('admin', 'doctor'),
  hospitalController.updateDoctorDetails
);

module.exports = router;