const express = require('express');
const pharmacyController = require('../controllers/pharmacyController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// ================= MEDICATION ROUTES =================
router
  .route('/medications')
  .get(pharmacyController.getAllMedications)
  .post(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.createMedication
  );

router
  .route('/medications/:id')
  .get(pharmacyController.getMedication)
  .patch(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.updateMedication
  )
  .delete(
    authController.restrictTo('admin'),
    pharmacyController.deleteMedication
  );

// ================= INVENTORY ROUTES =================
router
  .route('/inventory')
  .get(pharmacyController.getAllInventory)
  .post(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.createInventory
  );

router
  .route('/inventory/:id')
  .get(pharmacyController.getInventoryItem)
  .patch(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.updateInventory
  )
  .delete(
    authController.restrictTo('admin'),
    pharmacyController.deleteInventory
  );

// Adjust inventory quantity
router
  .route('/inventory/:id/adjust')
  .patch(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.adjustInventory
  );

// Get low stock alerts
router
  .route('/inventory/alerts/low-stock')
  .get(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.getLowStockAlerts
  );

// Get expiring medication alerts
router
  .route('/inventory/alerts/expiring')
  .get(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.getExpiringAlerts
  );

// ================= PRESCRIPTION PROCESSING ROUTES =================
router
  .route('/prescriptions/pending')
  .get(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.getPendingPrescriptions
  );

router
  .route('/prescriptions/:id/process')
  .patch(
    authController.restrictTo('pharmacist', 'admin'),
    pharmacyController.processPrescription
  );

module.exports = router;