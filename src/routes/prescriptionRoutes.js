const express = require('express');
const prescriptionController = require('../controllers/prescriptionController');
const authController = require('../controllers/authController');

const router = express.Router({ mergeParams: true });

// Protect all routes after this middleware
router.use(authController.protect);

// Routes accessible by patients, doctors, pharmacists and admin
router
  .route('/')
  .get(prescriptionController.getAllPrescriptions)
  .post(
    authController.restrictTo('doctor', 'admin'),
    prescriptionController.createPrescription
  );

router
  .route('/:id')
  .get(prescriptionController.getPrescription)
  .patch(
    authController.restrictTo('doctor', 'admin'),
    prescriptionController.updatePrescription
  )
  .delete(
    authController.restrictTo('doctor', 'admin'),
    prescriptionController.deletePrescription
  );

// Route for pharmacy staff to update prescription status
router
  .route('/:id/status')
  .patch(
    authController.restrictTo('pharmacist', 'admin'),
    prescriptionController.updatePrescriptionStatus
  );

// Generate prescription PDF
router
  .route('/:id/pdf')
  .get(prescriptionController.generatePrescriptionPDF);

// Get prescriptions for a specific patient
router
  .route('/patient/:patientId')
  .get(prescriptionController.getPatientPrescriptions);

module.exports = router;