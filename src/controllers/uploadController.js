const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Set up storage configuration
const storage = multer.memoryStorage(); // Store files in memory for processing

// File filter function
const fileFilter = (req, file, cb) => {
  // Allow images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } 
  // Allow PDFs
  else if (file.mimetype === 'application/pdf') {
    cb(null, true);
  }
  // Allow common document formats
  else if (
    file.mimetype === 'application/msword' || 
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    cb(null, true);
  }
  // Reject other file types
  else {
    cb(new AppError('Not an allowed file type. Please upload images, PDFs, or Office documents.', 400), false);
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Middleware for handling file uploads
exports.uploadSingle = upload.single('file');
exports.uploadMultiple = upload.array('files', 5); // Allow up to 5 files

// Process image uploads (resize and optimize)
exports.processImage = catchAsync(async (req, res, next) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return next();
  }
  
  // Create upload directory if it doesn't exist
  const uploadDir = path.join(__dirname, '../public/uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Generate unique filename
  const filename = `${uuidv4()}.jpeg`;
  
  // Process image with sharp
  await sharp(req.file.buffer)
    .resize(800) // Resize to max width of 800px
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`${uploadDir}/${filename}`);
  
  // Add the processed file path to the request
  req.file.filename = filename;
  req.file.path = `/uploads/${filename}`;
  
  next();
});

// Process document uploads
exports.processDocument = catchAsync(async (req, res, next) => {
  if (!req.file || req.file.mimetype.startsWith('image/')) {
    return next();
  }
  
  // Create upload directory if it doesn't exist
  const uploadDir = path.join(__dirname, '../public/uploads/documents');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
  // Generate unique filename
  const originalExt = path.extname(req.file.originalname);
  const filename = `${uuidv4()}${originalExt}`;
  
  // Save the file from buffer
  fs.writeFileSync(`${uploadDir}/${filename}`, req.file.buffer);
  
  // Add the file path to the request
  req.file.filename = filename;
  req.file.path = `/uploads/documents/${filename}`;
  
  next();
});

// Process multiple files
exports.processMultipleFiles = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }
  
  // Create upload directories if they don't exist
  const imageDir = path.join(__dirname, '../public/uploads');
  const docDir = path.join(__dirname, '../public/uploads/documents');
  
  if (!fs.existsSync(imageDir)) {
    fs.mkdirSync(imageDir, { recursive: true });
  }
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }
  
  // Process each file based on type
  const processPromises = req.files.map(async (file) => {
    if (file.mimetype.startsWith('image/')) {
      // Process image
      const filename = `${uuidv4()}.jpeg`;
      
      await sharp(file.buffer)
        .resize(800)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`${imageDir}/${filename}`);
      
      file.filename = filename;
      file.path = `/uploads/${filename}`;
    } else {
      // Process document
      const originalExt = path.extname(file.originalname);
      const filename = `${uuidv4()}${originalExt}`;
      
      fs.writeFileSync(`${docDir}/${filename}`, file.buffer);
      
      file.filename = filename;
      file.path = `/uploads/documents/${filename}`;
    }
  });
  
  await Promise.all(processPromises);
  
  next();
});

// Upload handler for single file
exports.uploadFile = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('No file uploaded', 400));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    }
  });
});

// Upload handler for multiple files
exports.uploadFiles = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('No files uploaded', 400));
  }
  
  const filesData = req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size
  }));
  
  res.status(200).json({
    status: 'success',
    results: filesData.length,
    data: {
      files: filesData
    }
  });
});

// Delete a file
exports.deleteFile = catchAsync(async (req, res, next) => {
  const { filename } = req.params;
  
  if (!filename) {
    return next(new AppError('No filename provided', 400));
  }
  
  // Determine file type and path
  let filePath;
  if (filename.endsWith('.jpeg') || filename.endsWith('.jpg')) {
    filePath = path.join(__dirname, '../public/uploads', filename);
  } else {
    filePath = path.join(__dirname, '../public/uploads/documents', filename);
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next(new AppError('File not found', 404));
  }
  
  // Delete the file
  fs.unlinkSync(filePath);
  
  res.status(200).json({
    status: 'success',
    message: 'File deleted successfully'
  });
});