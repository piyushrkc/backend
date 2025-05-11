// src/routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest, validators } = require('../middleware/validation');
const { cache, invalidateCache } = require('../middleware/cache');
const { paginate } = require('../middleware/pagination');
const config = require('../config/config');

// All routes require authentication
router.use(authenticate);

// Apply cache invalidation middleware to all routes
router.use(invalidateCache('appointment:*'));

// Get all appointments with filtering options
router.get('/', 
  paginate,
  config.cache.enabled ? cache(config.cache.ttl.appointments) : (req, res, next) => next(),
  appointmentController.getAppointments
);

// Get appointment by ID
router.get('/:id', 
  config.cache.enabled ? cache(config.cache.ttl.appointments) : (req, res, next) => next(),
  appointmentController.getAppointmentById
);

// Create new appointment
// Patients, doctors, receptionists, and admins can create appointments
router.post('/', 
  authorize('patient', 'doctor', 'admin', 'receptionist'), 
  validateRequest(validators.appointment.create),
  appointmentController.createAppointment
);

// Update appointment 
router.put('/:id', 
  authorize('patient', 'doctor', 'admin', 'receptionist'),
  validateRequest(validators.appointment.update),
  appointmentController.updateAppointment
);

// Cancel appointment
router.put('/:id/cancel', 
  validateRequest(validators.appointment.cancel),
  appointmentController.cancelAppointment
);

// Delete appointment (admin only)
router.delete('/:id', 
  authorize('admin'), 
  appointmentController.deleteAppointment
);

// Get doctor's schedule/availability
router.get('/doctor/schedule', 
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  appointmentController.getDoctorSchedule
);

// Get appointment statistics (admin, doctor, receptionist)
router.get('/stats/summary', 
  authorize('admin', 'doctor', 'receptionist'),
  config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
  appointmentController.getAppointmentStats
);

module.exports = router;