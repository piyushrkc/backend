const express = require('express');
const doctorController = require('../controllers/doctorController');
const authController = require('../controllers/authController');
const { cache, invalidateCache } = require('../middleware/cache');
const { paginate } = require('../middleware/pagination');
const config = require('../config/config');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Apply cache invalidation middleware to all routes
router.use(invalidateCache('doctor:*'));

// Restrict certain routes to specific roles
router.use(authController.restrictTo('admin', 'staff'));

router
  .route('/')
  .get(
    paginate,
    config.cache.enabled ? cache(config.cache.ttl.doctors) : (req, res, next) => next(),
    doctorController.getAllDoctors
  )
  .post(doctorController.createDoctor);

router
  .route('/:id')
  .get(
    config.cache.enabled ? cache(config.cache.ttl.doctors) : (req, res, next) => next(),
    doctorController.getDoctor
  )
  .patch(doctorController.updateDoctor)
  .delete(authController.restrictTo('admin'), doctorController.deleteDoctor);

router.route('/:id/schedule')
  .get(
    config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
    doctorController.getDoctorSchedule
  );

router.route('/:id/availability')
  .patch(doctorController.setAvailability);

router.route('/:id/patients')
  .get(
    paginate,
    config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
    doctorController.getDoctorPatients
  );

router.route('/:id/queue')
  .get(
    config.cache.enabled ? cache(config.cache.ttl.default) : (req, res, next) => next(),
    doctorController.getDoctorQueue
  );

module.exports = router;