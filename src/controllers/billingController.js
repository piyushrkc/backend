// src/controllers/billingController.js
const Invoice = require('../models/Invoice');
const BillingSettings = require('../models/BillingSettings');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Prescription = require('../models/Prescription');
const LabTest = require('../models/LabTest');
const Hospital = require('../models/Hospital');
const logger = require('../utils/logger');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Function to calculate the start and end of various date ranges
const getDateRanges = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const thisWeekStart = new Date(today);
  thisWeekStart.setDate(today.getDate() - today.getDay());
  
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const thisYearStart = new Date(today.getFullYear(), 0, 1);
  
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(thisMonthStart);
  lastMonthEnd.setDate(lastMonthEnd.getDate() - 1);
  
  return {
    today: {
      start: today,
      end: now
    },
    yesterday: {
      start: yesterday, 
      end: new Date(today.getTime() - 1)
    },
    thisWeek: {
      start: thisWeekStart,
      end: now
    },
    thisMonth: {
      start: thisMonthStart,
      end: now
    },
    lastMonth: {
      start: lastMonthStart,
      end: lastMonthEnd
    },
    thisYear: {
      start: thisYearStart,
      end: now
    }
  };
};

// Get billing settings
exports.getBillingSettings = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  
  // Find billing settings for the hospital
  let billingSettings = await BillingSettings.findOne({ hospital: hospitalId });
  
  // If no settings exist, create defaults
  if (!billingSettings) {
    billingSettings = await BillingSettings.create({
      hospital: hospitalId,
      // Default values are set in the model
      updatedBy: req.user.userId
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: billingSettings
  });
});

// Update billing settings
exports.updateBillingSettings = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  
  // Find existing settings or create new ones
  let billingSettings = await BillingSettings.findOne({ hospital: hospitalId });
  
  if (!billingSettings) {
    billingSettings = new BillingSettings({
      hospital: hospitalId
    });
  }
  
  // Update fields
  const {
    consultationFees,
    gstNumber,
    gstPercentage,
    currency,
    paymentMethods,
    invoicePrefix,
    termsAndConditions
  } = req.body;
  
  if (consultationFees) {
    billingSettings.consultationFees = {
      ...billingSettings.consultationFees,
      ...consultationFees
    };
  }
  
  if (gstNumber) billingSettings.gstNumber = gstNumber;
  if (gstPercentage !== undefined) billingSettings.gstPercentage = gstPercentage;
  if (currency) billingSettings.currency = currency;
  if (paymentMethods) billingSettings.paymentMethods = paymentMethods;
  if (invoicePrefix) billingSettings.invoicePrefix = invoicePrefix;
  if (termsAndConditions) billingSettings.termsAndConditions = termsAndConditions;
  
  billingSettings.updatedBy = req.user.userId;
  
  await billingSettings.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Billing settings updated successfully',
    data: billingSettings
  });
});

// Get invoices with filters
exports.getInvoices = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  
  // Extract filter parameters
  const {
    patientId,
    doctorId,
    startDate,
    endDate,
    paymentStatus,
    invoiceType,
    page = 1,
    limit = 10
  } = req.query;
  
  // Build query
  const query = { hospital: hospitalId };
  
  if (patientId) query.patient = patientId;
  if (doctorId) query.doctor = doctorId;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (invoiceType) query.invoiceType = invoiceType;
  
  if (startDate || endDate) {
    query.invoiceDate = {};
    if (startDate) query.invoiceDate.$gte = new Date(startDate);
    if (endDate) query.invoiceDate.$lte = new Date(endDate);
  }
  
  // Count total records
  const total = await Invoice.countDocuments(query);
  
  // Pagination
  const skip = (page - 1) * limit;
  
  // Fetch invoices
  const invoices = await Invoice.find(query)
    .sort({ invoiceDate: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('patient', 'firstName lastName')
    .populate('doctor', 'firstName lastName')
    .lean();
  
  res.status(200).json({
    status: 'success',
    results: invoices.length,
    total,
    pages: Math.ceil(total / limit),
    currentPage: parseInt(page),
    data: invoices
  });
});

// Get invoice by ID
exports.getInvoiceById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const invoice = await Invoice.findById(id)
    .populate('patient', 'firstName lastName email phone address')
    .populate('doctor', 'firstName lastName specialization')
    .populate('hospital', 'name address contactInfo')
    .lean();
  
  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: invoice
  });
});

// Create a new invoice
exports.createInvoice = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;
  
  // Extract data from request body
  const {
    patientId,
    doctorId,
    appointmentId,
    prescriptionId,
    labTestId,
    invoiceType,
    items,
    notes,
    paymentMethod,
    paidAmount,
    dueDate
  } = req.body;
  
  // Validate required fields
  if (!patientId || !invoiceType || !items || items.length === 0) {
    return next(new AppError('Missing required fields: patientId, invoiceType, and items are required', 400));
  }
  
  // Check if patient exists
  const patient = await Patient.findById(patientId);
  if (!patient) {
    return next(new AppError('Patient not found', 404));
  }
  
  // Check if doctor exists if provided
  let doctor = null;
  if (doctorId) {
    doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return next(new AppError('Doctor not found', 404));
    }
  }
  
  // Get hospital
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return next(new AppError('Hospital not found', 404));
  }
  
  // Get billing settings
  const billingSettings = await BillingSettings.findOne({ hospital: hospitalId }) 
    || await BillingSettings.create({ hospital: hospitalId, updatedBy: userId });
  
  // Generate invoice number
  const invoiceNumber = await Invoice.generateInvoiceNumber(
    billingSettings.invoicePrefix,
    hospital
  );
  
  // Calculate totals
  const calculateTotals = (items, gstPercentage) => {
    // Process items to ensure they have amount
    const processedItems = items.map(item => ({
      ...item,
      amount: item.amount || (item.quantity * item.unitPrice)
    }));
    
    const subtotal = processedItems.reduce((sum, item) => sum + item.amount, 0);
    const gstAmount = (subtotal * gstPercentage) / 100;
    const totalAmount = subtotal + gstAmount;
    
    return {
      processedItems,
      subtotal,
      gstAmount,
      totalAmount
    };
  };
  
  const { processedItems, subtotal, gstAmount, totalAmount } = calculateTotals(
    items,
    billingSettings.gstPercentage
  );
  
  // Determine payment status
  const paidAmt = parseFloat(paidAmount) || 0;
  const balanceDue = totalAmount - paidAmt;
  const paymentStatus = paidAmt === 0 ? 'unpaid' :
                       paidAmt < totalAmount ? 'partial' : 'paid';
  
  // Create new invoice
  const invoice = new Invoice({
    invoiceNumber,
    invoiceDate: new Date(),
    dueDate: dueDate ? new Date(dueDate) : undefined,
    patient: patientId,
    doctor: doctorId,
    appointment: appointmentId,
    prescription: prescriptionId,
    labTest: labTestId,
    invoiceType,
    items: processedItems,
    subtotal,
    gstNumber: billingSettings.gstNumber,
    gstPercentage: billingSettings.gstPercentage,
    gstAmount,
    totalAmount,
    paidAmount: paidAmt,
    balanceDue,
    paymentMethod,
    paymentStatus,
    notes,
    paymentDate: paymentStatus === 'paid' ? new Date() : undefined,
    createdBy: userId,
    hospital: hospitalId
  });
  
  await invoice.save();
  
  // Populate patient and doctor info
  await invoice.populate('patient', 'firstName lastName');
  await invoice.populate('doctor', 'firstName lastName');
  
  res.status(201).json({
    status: 'success',
    message: 'Invoice created successfully',
    data: invoice
  });
});

// Update invoice payment status
exports.updateInvoicePayment = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { paidAmount, paymentMethod, paymentDate } = req.body;
  
  const invoice = await Invoice.findById(id);
  
  if (!invoice) {
    return next(new AppError('Invoice not found', 404));
  }
  
  // Update payment details
  if (paidAmount !== undefined) {
    invoice.paidAmount = parseFloat(paidAmount);
  }
  
  if (paymentMethod) {
    invoice.paymentMethod = paymentMethod;
  }
  
  if (paymentDate) {
    invoice.paymentDate = new Date(paymentDate);
  }
  
  // Calculate balance due and payment status
  invoice.balanceDue = invoice.totalAmount - invoice.paidAmount;
  
  if (invoice.paidAmount <= 0) {
    invoice.paymentStatus = 'unpaid';
  } else if (invoice.paidAmount < invoice.totalAmount) {
    invoice.paymentStatus = 'partial';
  } else {
    invoice.paymentStatus = 'paid';
    invoice.paymentDate = invoice.paymentDate || new Date();
  }
  
  await invoice.save();
  
  res.status(200).json({
    status: 'success',
    message: 'Invoice payment updated successfully',
    data: invoice
  });
});

// Generate consultation invoice from appointment
exports.generateConsultationInvoice = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;
  
  const { appointmentId, paymentMethod, paidAmount } = req.body;
  
  if (!appointmentId) {
    return next(new AppError('Appointment ID is required', 400));
  }
  
  // Get appointment
  const appointment = await Appointment.findById(appointmentId)
    .populate('patient', 'firstName lastName')
    .populate('doctor', 'firstName lastName specialization');
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }
  
  // Check if invoice already exists for this appointment
  const existingInvoice = await Invoice.findOne({ appointment: appointmentId });
  
  if (existingInvoice) {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice already exists for this appointment',
      data: { invoiceId: existingInvoice._id }
    });
  }
  
  // Get billing settings
  const billingSettings = await BillingSettings.findOne({ hospital: hospitalId }) 
    || await BillingSettings.create({ hospital: hospitalId, updatedBy: userId });
  
  // Determine fee based on appointment type
  let feeAmount = billingSettings.consultationFees.standard;
  const appointmentType = appointment.appointmentType?.toLowerCase() || 'standard';
  
  if (appointmentType.includes('follow')) {
    feeAmount = billingSettings.consultationFees.followUp;
  } else if (appointmentType.includes('specialist')) {
    feeAmount = billingSettings.consultationFees.specialist;
  } else if (appointmentType.includes('emergency')) {
    feeAmount = billingSettings.consultationFees.emergency;
  }
  
  // Set up invoice items
  const items = [{
    description: `${appointmentType.charAt(0).toUpperCase() + appointmentType.slice(1)} Consultation with ${appointment.doctor.firstName} ${appointment.doctor.lastName}`,
    quantity: 1,
    unitPrice: feeAmount,
    amount: feeAmount,
    hsn: '998331',
    gstRate: billingSettings.gstPercentage
  }];
  
  // Generate invoice
  const invoiceData = {
    patientId: appointment.patient._id,
    doctorId: appointment.doctor._id,
    appointmentId,
    invoiceType: 'consultation',
    items,
    notes: `Consultation on ${new Date(appointment.appointmentDate).toLocaleDateString()}, ${appointment.appointmentTime}`,
    paymentMethod: paymentMethod || 'Cash',
    paidAmount: parseFloat(paidAmount) || 0
  };
  
  // Create invoice
  const result = await exports.createInvoice({ 
    body: invoiceData, 
    user: req.user,
    params: {} 
  }, { 
    status: () => ({ json: (data) => data })
  }, () => {});
  
  res.status(201).json(result);
});

// Generate lab invoice
exports.generateLabInvoice = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;
  
  const { labTestIds, patientId, paymentMethod, paidAmount } = req.body;
  
  if (!labTestIds || !Array.isArray(labTestIds) || labTestIds.length === 0 || !patientId) {
    return next(new AppError('Lab test IDs and patient ID are required', 400));
  }
  
  // Get patient
  const patient = await Patient.findById(patientId);
  
  if (!patient) {
    return next(new AppError('Patient not found', 404));
  }
  
  // Get lab tests
  const labTests = await LabTest.find({ _id: { $in: labTestIds } });
  
  if (labTests.length === 0) {
    return next(new AppError('No lab tests found', 404));
  }
  
  // Get billing settings
  const billingSettings = await BillingSettings.findOne({ hospital: hospitalId }) 
    || await BillingSettings.create({ hospital: hospitalId, updatedBy: userId });
  
  // Create invoice items from lab tests
  const items = labTests.map(test => ({
    description: test.name,
    quantity: 1,
    unitPrice: test.price || 0,
    amount: test.price || 0,
    hsn: '998341',
    gstRate: billingSettings.gstPercentage
  }));
  
  // Generate invoice
  const invoiceData = {
    patientId,
    invoiceType: 'laboratory',
    items,
    notes: `Laboratory tests ordered on ${new Date().toLocaleDateString()}`,
    paymentMethod: paymentMethod || 'Cash',
    paidAmount: parseFloat(paidAmount) || 0
  };
  
  // Create invoice
  const result = await exports.createInvoice({ 
    body: invoiceData, 
    user: req.user,
    params: {} 
  }, { 
    status: () => ({ json: (data) => data })
  }, () => {});
  
  res.status(201).json(result);
});

// Generate pharmacy invoice from prescription
exports.generatePharmacyInvoice = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  const userId = req.user.userId;
  
  const { prescriptionId, paymentMethod, paidAmount } = req.body;
  
  if (!prescriptionId) {
    return next(new AppError('Prescription ID is required', 400));
  }
  
  // Get prescription with populated data
  const prescription = await Prescription.findById(prescriptionId)
    .populate('patient', 'firstName lastName')
    .populate('doctor', 'firstName lastName')
    .populate('medications.medication', 'name price');
  
  if (!prescription) {
    return next(new AppError('Prescription not found', 404));
  }
  
  // Check if invoice already exists for this prescription
  const existingInvoice = await Invoice.findOne({ prescription: prescriptionId });
  
  if (existingInvoice) {
    return res.status(400).json({
      status: 'error',
      message: 'Invoice already exists for this prescription',
      data: { invoiceId: existingInvoice._id }
    });
  }
  
  // Get billing settings
  const billingSettings = await BillingSettings.findOne({ hospital: hospitalId }) 
    || await BillingSettings.create({ hospital: hospitalId, updatedBy: userId });
  
  // Create invoice items from medications with detailed descriptions
  const items = prescription.medications.map(med => {
    const medication = med.medication;
    const unitPrice = medication.price || 0;

    // Create more detailed description with dosage instructions
    let description = `${medication.name} - ${med.dosage}`;
    if (med.frequency) {
      description += `, ${med.frequency}`;
    }
    if (med.duration) {
      description += `, for ${med.duration}`;
    }
    if (med.instructions) {
      description += ` (${med.instructions})`;
    }

    return {
      description,
      quantity: med.quantity,
      unitPrice,
      amount: unitPrice * med.quantity,
      hsn: '30049099', // Standard HSN code for pharmaceuticals
      gstRate: billingSettings.gstPercentage
    };
  });
  
  // Generate invoice
  const invoiceData = {
    patientId: prescription.patient._id,
    doctorId: prescription.doctor._id,
    prescriptionId,
    invoiceType: 'pharmacy',
    items,
    notes: `Prescription dispensed on ${new Date().toLocaleDateString()}`,
    paymentMethod: paymentMethod || 'Cash',
    paidAmount: parseFloat(paidAmount) || 0
  };
  
  // Create invoice
  const result = await exports.createInvoice({ 
    body: invoiceData, 
    user: req.user,
    params: {} 
  }, { 
    status: () => ({ json: (data) => data })
  }, () => {});
  
  res.status(201).json(result);
});

// Get billing statistics 
exports.getBillingStatistics = catchAsync(async (req, res, next) => {
  const hospitalId = req.user.hospitalId;
  const { period = 'thisMonth' } = req.query;
  
  // Get date ranges
  const dateRanges = getDateRanges();
  const selectedRange = dateRanges[period] || dateRanges.thisMonth;
  
  // Base match criteria
  const match = { 
    hospital: mongoose.Types.ObjectId(hospitalId),
    invoiceDate: { 
      $gte: selectedRange.start, 
      $lte: selectedRange.end 
    }
  };
  
  // Aggregate invoices 
  const invoiceStats = await Invoice.aggregate([
    { $match: match },
    { 
      $group: {
        _id: null,
        totalInvoices: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        paidAmount: { $sum: '$paidAmount' },
        pendingAmount: { $sum: '$balanceDue' }
      }
    }
  ]);
  
  // Group by invoice type
  const typeStats = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$invoiceType',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        paidAmount: { $sum: '$paidAmount' },
        pendingAmount: { $sum: '$balanceDue' }
      }
    }
  ]);
  
  // Group by payment status
  const statusStats = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$paymentStatus',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
  
  // Group by payment method
  const methodStats = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        paidAmount: { $sum: '$paidAmount' }
      }
    }
  ]);
  
  // Create a formatted result object
  const statistics = {
    period: {
      name: period,
      startDate: selectedRange.start,
      endDate: selectedRange.end
    },
    summary: invoiceStats.length > 0 ? invoiceStats[0] : {
      totalInvoices: 0,
      totalAmount: 0,
      paidAmount: 0,
      pendingAmount: 0
    },
    byType: typeStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
        paidAmount: stat.paidAmount,
        pendingAmount: stat.pendingAmount
      };
      return acc;
    }, {}),
    byStatus: statusStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount
      };
      return acc;
    }, {}),
    byPaymentMethod: methodStats.reduce((acc, stat) => {
      acc[stat._id] = {
        count: stat.count,
        paidAmount: stat.paidAmount
      };
      return acc;
    }, {})
  };
  
  res.status(200).json({
    status: 'success',
    data: statistics
  });
});