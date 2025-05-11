// src/routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, validators } = require('../middleware/validation');
const { cache, invalidateCache } = require('../middleware/cache');
const { paginate } = require('../middleware/pagination');
const config = require('../config/config');

// All routes require authentication
router.use(authenticate);

// Apply cache invalidation for any billing-related routes
router.use(invalidateCache('billing:*'));

// Billing Settings
router.get('/settings', billingController.getBillingSettings);
router.put('/settings', authorize('admin'), billingController.updateBillingSettings);

// Invoices
router.get('/invoices',
  paginate,
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  billingController.getInvoices
);

router.get('/invoices/:id',
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  billingController.getInvoiceById
);

router.post('/invoices', billingController.createInvoice);
router.put('/invoices/:id/payment', billingController.updateInvoicePayment);

// Special invoice generation endpoints
router.post('/invoices/consultation', billingController.generateConsultationInvoice);
router.post('/invoices/laboratory', billingController.generateLabInvoice);
router.post('/invoices/pharmacy', billingController.generatePharmacyInvoice);

// Legacy routes - for backward compatibility
router.get('/', paginate, billingController.getInvoices);
router.get('/:id', billingController.getInvoiceById);
router.post('/', billingController.createInvoice);
router.put('/:id/payment', billingController.updateInvoicePayment);

// Statistics
router.get('/statistics',
  authorize('admin', 'accountant'),
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  billingController.getBillingStatistics
);

module.exports = router;