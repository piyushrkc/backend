// backend/src/routes/patientRoutes.js
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const { authenticate, authorize } = require('../middleware/auth');
const { cache, invalidateCache } = require('../middleware/cache');
const { paginate } = require('../middleware/pagination');
const config = require('../config/config');

// All routes require authentication
router.use(authenticate);

// Apply cache invalidation middleware to all routes
router.use(invalidateCache('patient:*'));

// Get all patients (admin, doctor, receptionist)
router.get('/', 
  authorize('admin', 'doctor', 'receptionist'),
  paginate,
  config.cache.enabled ? cache(config.cache.ttl.patients) : (req, res, next) => next(),
  patientController.getPatients
);

// Get patient by ID
router.get('/:id', 
  authorize('admin', 'doctor', 'receptionist', 'patient'),
  config.cache.enabled ? cache(config.cache.ttl.patients) : (req, res, next) => next(),
  patientController.getPatientById
);

// Create new patient (admin, receptionist)
router.post('/', authorize('admin', 'receptionist'), patientController.createPatient);

// Update patient
router.put('/:id', authorize('admin', 'receptionist'), patientController.updatePatient);

// Delete patient (admin only)
router.delete('/:id', authorize('admin'), patientController.deletePatient);

// Get patient medical history
router.get('/:id/medical-history', 
  authorize('admin', 'doctor', 'patient'),
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  patientController.getPatientMedicalHistory
);

module.exports = router;