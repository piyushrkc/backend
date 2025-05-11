const express = require('express');
const uploadController = require('../controllers/uploadController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Single file upload routes
router.post(
  '/file',
  uploadController.uploadSingle,
  uploadController.processImage,
  uploadController.processDocument,
  uploadController.uploadFile
);

// Multiple file upload routes
router.post(
  '/files',
  uploadController.uploadMultiple,
  uploadController.processMultipleFiles,
  uploadController.uploadFiles
);

// Delete file route
router.delete(
  '/file/:filename',
  authController.restrictTo('admin', 'doctor', 'staff'),
  uploadController.deleteFile
);

module.exports = router;