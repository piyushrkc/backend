const express = require('express');
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Routes for user's own notifications
router.route('/me')
  .get(notificationController.getUserNotifications);

router.route('/me/unread-count')
  .get(notificationController.getUnreadCount);

router.route('/me/mark-all-read')
  .patch(notificationController.markAllAsRead);

router.route('/:id')
  .patch(notificationController.markAsRead)
  .delete(notificationController.deleteNotification);

// Routes for admins/staff to create notifications
router.use(authController.restrictTo('admin', 'staff', 'doctor', 'nurse'));

router.route('/')
  .post(notificationController.createNotification);

router.route('/bulk')
  .post(notificationController.sendBulkNotifications);

router.route('/appointment-reminder')
  .post(notificationController.sendAppointmentReminders);

router.route('/lab-result')
  .post(notificationController.sendLabResultNotification);

router.route('/medication-reminder')
  .post(notificationController.sendMedicationReminder);

// System notifications - admin only
router.use(authController.restrictTo('admin'));

router.route('/system')
  .post(notificationController.sendSystemNotification);

module.exports = router;