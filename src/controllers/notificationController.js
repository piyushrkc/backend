const Notification = require('../models/Notification');
const User = require('../models/User');
const Patient = require('../models/Patient');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Create a notification
exports.createNotification = catchAsync(async (req, res, next) => {
  const newNotification = await Notification.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      notification: newNotification
    }
  });
});

// Get all notifications for a user
exports.getUserNotifications = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { read } = req.query;
  
  const filter = { recipient: userId };
  
  // Filter by read status if specified
  if (read === 'true') {
    filter.read = true;
  } else if (read === 'false') {
    filter.read = false;
  }
  
  const notifications = await Notification.find(filter)
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: notifications.length,
    data: {
      notifications
    }
  });
});

// Mark notification as read
exports.markAsRead = catchAsync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }
  
  // Check if user is the recipient
  if (notification.recipient.toString() !== req.user.id) {
    return next(new AppError('You are not authorized to access this notification', 403));
  }
  
  notification.read = true;
  notification.readAt = Date.now();
  await notification.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      notification
    }
  });
});

// Mark all notifications as read
exports.markAllAsRead = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: Date.now() }
  );
  
  res.status(200).json({
    status: 'success',
    message: 'All notifications marked as read'
  });
});

// Delete notification
exports.deleteNotification = catchAsync(async (req, res, next) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    return next(new AppError('No notification found with that ID', 404));
  }
  
  // Check if user is the recipient
  if (notification.recipient.toString() !== req.user.id) {
    return next(new AppError('You are not authorized to delete this notification', 403));
  }
  
  await Notification.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Send notification to multiple users
exports.sendBulkNotifications = catchAsync(async (req, res, next) => {
  const { title, content, recipients, type, link } = req.body;
  
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return next(new AppError('Recipients are required', 400));
  }
  
  const notificationPromises = recipients.map(recipient => {
    return Notification.create({
      recipient,
      title,
      content,
      type,
      link,
      createdBy: req.user.id
    });
  });
  
  const notifications = await Promise.all(notificationPromises);
  
  res.status(201).json({
    status: 'success',
    results: notifications.length,
    data: {
      notifications
    }
  });
});

// Send appointment reminder notifications
exports.sendAppointmentReminders = catchAsync(async (req, res, next) => {
  const { appointmentId, patientId, doctorId, appointmentDate, appointmentTime } = req.body;
  
  // Find the patient and doctor
  const patient = await User.findById(patientId);
  const doctor = await User.findById(doctorId);
  
  if (!patient || !doctor) {
    return next(new AppError('Patient or doctor not found', 404));
  }
  
  // Create notification for patient
  const patientNotification = await Notification.create({
    recipient: patientId,
    title: 'Appointment Reminder',
    content: `You have an appointment with Dr. ${doctor.name} on ${appointmentDate} at ${appointmentTime}.`,
    type: 'appointment',
    link: `/appointments/${appointmentId}`,
    createdBy: req.user.id
  });
  
  // Create notification for doctor
  const doctorNotification = await Notification.create({
    recipient: doctorId,
    title: 'Appointment Reminder',
    content: `You have an appointment with ${patient.name} on ${appointmentDate} at ${appointmentTime}.`,
    type: 'appointment',
    link: `/appointments/${appointmentId}`,
    createdBy: req.user.id
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      patientNotification,
      doctorNotification
    }
  });
});

// Send lab result notifications
exports.sendLabResultNotification = catchAsync(async (req, res, next) => {
  const { patientId, doctorId, labTestId, testName } = req.body;
  
  // Create notification for patient
  const patientNotification = await Notification.create({
    recipient: patientId,
    title: 'Lab Results Available',
    content: `Your results for ${testName} are now available.`,
    type: 'lab_result',
    link: `/lab-tests/${labTestId}`,
    createdBy: req.user.id
  });
  
  // Create notification for doctor if provided
  let doctorNotification;
  if (doctorId) {
    doctorNotification = await Notification.create({
      recipient: doctorId,
      title: 'Lab Results Available',
      content: `Lab results for ${testName} are now available for your patient.`,
      type: 'lab_result',
      link: `/lab-tests/${labTestId}`,
      createdBy: req.user.id
    });
  }
  
  res.status(201).json({
    status: 'success',
    data: {
      patientNotification,
      doctorNotification
    }
  });
});

// Send medication reminder notifications
exports.sendMedicationReminder = catchAsync(async (req, res, next) => {
  const { patientId, medicationName, dosage, time } = req.body;
  
  const notification = await Notification.create({
    recipient: patientId,
    title: 'Medication Reminder',
    content: `It's time to take ${medicationName} ${dosage}. Scheduled for ${time}.`,
    type: 'medication_reminder',
    createdBy: req.user.id
  });
  
  res.status(201).json({
    status: 'success',
    data: {
      notification
    }
  });
});

// Send system notifications to all users or specific roles
exports.sendSystemNotification = catchAsync(async (req, res, next) => {
  const { title, content, roles } = req.body;
  
  // Find users to send notification to
  const filter = {};
  if (roles && Array.isArray(roles) && roles.length > 0) {
    filter.role = { $in: roles };
  }
  
  const users = await User.find(filter).select('_id');
  
  if (users.length === 0) {
    return next(new AppError('No users found with the specified roles', 404));
  }
  
  // Create notifications for all users
  const notificationPromises = users.map(user => {
    return Notification.create({
      recipient: user._id,
      title,
      content,
      type: 'system',
      createdBy: req.user.id
    });
  });
  
  await Promise.all(notificationPromises);
  
  res.status(201).json({
    status: 'success',
    message: `Notification sent to ${users.length} users`,
    recipients: users.length
  });
});

// Get unread notification count
exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  
  const count = await Notification.countDocuments({
    recipient: userId,
    read: false
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      count
    }
  });
});