// src/routes/walkInRoutes.js
const express = require('express');
const router = express.Router();
const walkInController = require('../controllers/walkInController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Routes for handling walk-in customers for pharmacy and laboratory
 */

// Protect all routes - require authentication
router.use(authenticate);

// Only allow staff, pharmacists, lab technicians and admins to access these routes
router.use(authorize('admin', 'pharmacist', 'staff', 'lab_technician'));

// Pharmacy invoice routes
router.post(
  '/pharmacy/invoice',
  authorize('admin', 'pharmacist', 'staff'),
  walkInController.createPharmacyInvoice
);

// Laboratory invoice routes
router.post(
  '/laboratory/invoice',
  authorize('admin', 'lab_technician', 'staff'),
  walkInController.createLaboratoryInvoice
);

// Get all walk-in invoices
router.get(
  '/invoices',
  walkInController.getWalkInInvoices
);

// Get walk-in invoice by ID
router.get(
  '/invoices/:id',
  walkInController.getWalkInInvoiceById
);

module.exports = router;