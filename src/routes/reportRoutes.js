const express = require('express');
const reportController = require('../controllers/reportController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Restrict report access to admin, managers and staff
router.use(authController.restrictTo('admin', 'manager', 'accountant', 'doctor'));

// Appointment reports
router.get('/appointments/daily', reportController.getDailyAppointmentsReport);
router.get('/appointments/monthly', reportController.getMonthlyAppointmentsReport);

// Financial reports
router.get('/revenue', 
  authController.restrictTo('admin', 'manager', 'accountant'),
  reportController.getRevenueReport
);

// Patient demographics
router.get('/patients/demographics', reportController.getPatientDemographicsReport);

// Doctor performance
router.get('/doctors/performance', reportController.getDoctorPerformanceReport);

// Inventory reports
router.get('/inventory/status', 
  authController.restrictTo('admin', 'manager', 'pharmacist'),
  reportController.getInventoryStatusReport
);

// Lab test reports
router.get('/lab-tests', 
  authController.restrictTo('admin', 'manager', 'lab_technician', 'doctor'),
  reportController.getLabTestReport
);

module.exports = router;