const express = require('express');
const labController = require('../controllers/labController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Protect all routes after this middleware
router.use(authController.protect);

// Lab test routes
router
  .route('/tests')
  .get(labController.getAllLabTests)
  .post(
    authController.restrictTo('doctor', 'admin'),
    labController.createLabTest
  );

router
  .route('/tests/:id')
  .get(labController.getLabTest)
  .patch(
    authController.restrictTo('doctor', 'lab_technician', 'admin'),
    labController.updateLabTest
  )
  .delete(
    authController.restrictTo('doctor', 'admin'),
    labController.deleteLabTest
  );

// Update lab test status
router
  .route('/tests/:id/status')
  .patch(
    authController.restrictTo('lab_technician', 'admin'),
    labController.updateLabTestStatus
  );

// Lab result routes
router
  .route('/results')
  .post(
    authController.restrictTo('lab_technician', 'admin'),
    labController.createLabResult
  );

router
  .route('/results/:id')
  .get(labController.getLabResult)
  .patch(
    authController.restrictTo('lab_technician', 'admin'),
    labController.updateLabResult
  );

// Generate lab result PDF
router
  .route('/results/:id/pdf')
  .get(labController.generateLabResultPDF);

// Get lab tests for a specific patient
router
  .route('/patient/:patientId')
  .get(labController.getPatientLabTests);

module.exports = router;