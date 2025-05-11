// src/routes/medicationRoutes.js
const express = require('express');
const router = express.Router();
const medicationController = require('../controllers/medicationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, validators } = require('../middleware/validation');

// All routes require authentication
router.use(authenticate);

// Get all medications
router.get('/', medicationController.getMedications);

// Get medication by ID
router.get('/:id', medicationController.getMedicationById);

// Create new medication (admin, pharmacist)
router.post('/', 
  authorize('admin', 'pharmacist'), 
  validateRequest(validators.medication.create),
  medicationController.createMedication
);

// Update medication
router.put('/:id', 
  authorize('admin', 'pharmacist'), 
  validateRequest(validators.medication.update || []),
  medicationController.updateMedication
);

// Delete medication (admin only)
router.delete('/:id', 
  authorize('admin'), 
  medicationController.deleteMedication
);

// Update medication inventory
router.put('/:id/inventory', 
  authorize('admin', 'pharmacist'), 
  validateRequest(validators.medication.updateInventory),
  medicationController.updateInventory
);

// Get low stock medications
router.get('/inventory/low-stock', 
  authorize('admin', 'pharmacist'), 
  medicationController.getLowStockMedications
);

module.exports = router;