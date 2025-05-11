const LabTest = require('../models/LabTest');
const LabResult = require('../models/LabResult');
const Patient = require('../models/Patient');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Create a new lab test order
exports.createLabTest = catchAsync(async (req, res, next) => {
  // Add doctor ID from authenticated user if doctor is creating
  if (req.user.role === 'doctor') {
    req.body.orderedBy = req.user.id;
  }
  
  const newLabTest = await LabTest.create(req.body);
  
  // Update patient's lab test history
  await Patient.findByIdAndUpdate(
    req.body.patient,
    { $push: { labTests: newLabTest._id } }
  );
  
  res.status(201).json({
    status: 'success',
    data: {
      labTest: newLabTest
    }
  });
});

// Get all lab tests
exports.getAllLabTests = catchAsync(async (req, res, next) => {
  // Filter by patient if specified
  const filter = {};
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.orderedBy) filter.orderedBy = req.query.orderedBy;
  if (req.query.status) filter.status = req.query.status;
  
  const labTests = await LabTest.find(filter)
    .populate('patient', 'name')
    .populate('orderedBy', 'name specialization')
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: labTests.length,
    data: {
      labTests
    }
  });
});

// Get a specific lab test
exports.getLabTest = catchAsync(async (req, res, next) => {
  const labTest = await LabTest.findById(req.params.id)
    .populate('patient', 'name contactNumber dateOfBirth gender')
    .populate('orderedBy', 'name specialization')
    .populate('result');
  
  if (!labTest) {
    return next(new AppError('No lab test found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      labTest
    }
  });
});

// Update lab test
exports.updateLabTest = catchAsync(async (req, res, next) => {
  // Don't allow status changes through this route
  if (req.body.status) {
    delete req.body.status;
  }
  
  const labTest = await LabTest.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!labTest) {
    return next(new AppError('No lab test found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      labTest
    }
  });
});

// Delete lab test
exports.deleteLabTest = catchAsync(async (req, res, next) => {
  const labTest = await LabTest.findById(req.params.id);
  
  if (!labTest) {
    return next(new AppError('No lab test found with that ID', 404));
  }
  
  // Check if lab test can be deleted (only if it's not processed yet)
  if (labTest.status !== 'ordered') {
    return next(new AppError('Cannot delete a test that is already in process or completed', 400));
  }
  
  // Remove lab test from patient's history
  await Patient.findByIdAndUpdate(
    labTest.patient,
    { $pull: { labTests: labTest._id } }
  );
  
  await LabTest.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Update lab test status
exports.updateLabTestStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!['ordered', 'collected', 'processing', 'completed', 'cancelled'].includes(status)) {
    return next(new AppError('Invalid lab test status', 400));
  }
  
  const labTest = await LabTest.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      processedBy: req.user.id,
      updatedAt: Date.now()
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!labTest) {
    return next(new AppError('No lab test found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      labTest
    }
  });
});

// Create lab result
exports.createLabResult = catchAsync(async (req, res, next) => {
  // Add lab technician ID who is entering the result
  req.body.enteredBy = req.user.id;
  
  const labTest = await LabTest.findById(req.body.labTest);
  
  if (!labTest) {
    return next(new AppError('No lab test found with that ID', 404));
  }
  
  // Create new lab result
  const newLabResult = await LabResult.create(req.body);
  
  // Update lab test with the result and status
  labTest.result = newLabResult._id;
  labTest.status = 'completed';
  labTest.completedAt = Date.now();
  await labTest.save();
  
  res.status(201).json({
    status: 'success',
    data: {
      labResult: newLabResult
    }
  });
});

// Get a lab result
exports.getLabResult = catchAsync(async (req, res, next) => {
  const labResult = await LabResult.findById(req.params.id)
    .populate({
      path: 'labTest',
      populate: {
        path: 'patient orderedBy',
        select: 'name contactNumber dateOfBirth gender specialization'
      }
    })
    .populate('enteredBy', 'name');
  
  if (!labResult) {
    return next(new AppError('No lab result found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      labResult
    }
  });
});

// Update lab result
exports.updateLabResult = catchAsync(async (req, res, next) => {
  // Add lab technician ID who is updating the result
  req.body.updatedBy = req.user.id;
  req.body.updatedAt = Date.now();
  
  const labResult = await LabResult.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!labResult) {
    return next(new AppError('No lab result found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      labResult
    }
  });
});

// Get lab tests for a specific patient
exports.getPatientLabTests = catchAsync(async (req, res, next) => {
  const patientId = req.params.patientId;
  
  const labTests = await LabTest.find({ patient: patientId })
    .populate('orderedBy', 'name specialization')
    .populate('result')
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: labTests.length,
    data: {
      labTests
    }
  });
});

// Generate lab result PDF
exports.generateLabResultPDF = catchAsync(async (req, res, next) => {
  const labResult = await LabResult.findById(req.params.id)
    .populate({
      path: 'labTest',
      populate: {
        path: 'patient orderedBy',
        select: 'name contactNumber dateOfBirth gender specialization'
      }
    });
  
  if (!labResult) {
    return next(new AppError('No lab result found with that ID', 404));
  }
  
  // PDF generation logic would be implemented here
  // This typically involves a library like PDFKit or using a service
  
  // For now, we'll just return a success message
  res.status(200).json({
    status: 'success',
    message: 'PDF generation would happen here',
    data: {
      labResult
    }
  });
});