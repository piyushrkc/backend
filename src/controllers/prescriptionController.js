const Prescription = require('../models/Prescription');
const Patient = require('../models/Patient');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Create a new prescription
exports.createPrescription = catchAsync(async (req, res, next) => {
  // Add doctor ID from authenticated user if doctor is creating
  if (req.user.role === 'doctor') {
    req.body.doctor = req.user.id;
  }
  
  const newPrescription = await Prescription.create(req.body);
  
  // Update patient's prescription history
  await Patient.findByIdAndUpdate(
    req.body.patient,
    { $push: { prescriptions: newPrescription._id } }
  );
  
  res.status(201).json({
    status: 'success',
    data: {
      prescription: newPrescription
    }
  });
});

// Get all prescriptions
exports.getAllPrescriptions = catchAsync(async (req, res, next) => {
  // Filter by patient if specified
  const filter = {};
  if (req.query.patient) filter.patient = req.query.patient;
  if (req.query.doctor) filter.doctor = req.query.doctor;
  if (req.query.status) filter.status = req.query.status;
  
  const prescriptions = await Prescription.find(filter)
    .populate('patient', 'name')
    .populate('doctor', 'name specialization')
    .populate('medications.medication', 'name dosageForm strength');
  
  res.status(200).json({
    status: 'success',
    results: prescriptions.length,
    data: {
      prescriptions
    }
  });
});

// Get a specific prescription
exports.getPrescription = catchAsync(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'name contactNumber dateOfBirth allergies')
    .populate('doctor', 'name specialization contactNumber')
    .populate('medications.medication', 'name dosageForm strength contraindications sideEffects');
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      prescription
    }
  });
});

// Update prescription
exports.updatePrescription = catchAsync(async (req, res, next) => {
  // Don't allow status changes through this route
  if (req.body.status) {
    delete req.body.status;
  }
  
  const prescription = await Prescription.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      prescription
    }
  });
});

// Delete prescription
exports.deletePrescription = catchAsync(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  // Check if prescription can be deleted (only if it's not filled yet)
  if (prescription.status !== 'pending') {
    return next(new AppError('Cannot delete a filled or completed prescription', 400));
  }
  
  // Remove prescription from patient's history
  await Patient.findByIdAndUpdate(
    prescription.patient,
    { $pull: { prescriptions: prescription._id } }
  );
  
  await Prescription.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Update prescription status (for pharmacy workflow)
exports.updatePrescriptionStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!['pending', 'filled', 'completed', 'denied'].includes(status)) {
    return next(new AppError('Invalid prescription status', 400));
  }
  
  const prescription = await Prescription.findByIdAndUpdate(
    req.params.id,
    { 
      status,
      processedBy: req.user.id,
      processedAt: Date.now()
    },
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      prescription
    }
  });
});

// Get prescriptions for a specific patient
exports.getPatientPrescriptions = catchAsync(async (req, res, next) => {
  const patientId = req.params.patientId;
  
  const prescriptions = await Prescription.find({ patient: patientId })
    .populate('doctor', 'name specialization')
    .populate('medications.medication', 'name dosageForm strength')
    .sort('-createdAt');
  
  res.status(200).json({
    status: 'success',
    results: prescriptions.length,
    data: {
      prescriptions
    }
  });
});

// Generate prescription PDF
exports.generatePrescriptionPDF = catchAsync(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id)
    .populate('patient', 'name contactNumber dateOfBirth allergies')
    .populate('doctor', 'name specialization contactNumber')
    .populate('medications.medication', 'name dosageForm strength');
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  // PDF generation logic would be implemented here
  // This typically involves a library like PDFKit or using a service
  
  // For now, we'll just return a success message
  res.status(200).json({
    status: 'success',
    message: 'PDF generation would happen here',
    data: {
      prescription
    }
  });
});