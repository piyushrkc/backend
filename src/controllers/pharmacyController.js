const Medication = require('../models/Medication');
const Inventory = require('../models/Inventory');
const Prescription = require('../models/Prescription');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// ================= MEDICATION MANAGEMENT =================

// Create a new medication
exports.createMedication = catchAsync(async (req, res, next) => {
  const newMedication = await Medication.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      medication: newMedication
    }
  });
});

// Get all medications
exports.getAllMedications = catchAsync(async (req, res, next) => {
  // Apply filters if provided
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.dosageForm) filter.dosageForm = req.query.dosageForm;
  
  const medications = await Medication.find(filter);
  
  res.status(200).json({
    status: 'success',
    results: medications.length,
    data: {
      medications
    }
  });
});

// Get a specific medication
exports.getMedication = catchAsync(async (req, res, next) => {
  const medication = await Medication.findById(req.params.id);
  
  if (!medication) {
    return next(new AppError('No medication found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      medication
    }
  });
});

// Update medication information
exports.updateMedication = catchAsync(async (req, res, next) => {
  const medication = await Medication.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!medication) {
    return next(new AppError('No medication found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      medication
    }
  });
});

// Delete a medication
exports.deleteMedication = catchAsync(async (req, res, next) => {
  const medication = await Medication.findById(req.params.id);
  
  if (!medication) {
    return next(new AppError('No medication found with that ID', 404));
  }
  
  // Check if medication is in inventory before deleting
  const inventoryItem = await Inventory.findOne({ medication: req.params.id });
  if (inventoryItem) {
    return next(new AppError('Cannot delete medication that exists in inventory', 400));
  }
  
  await Medication.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// ================= INVENTORY MANAGEMENT =================

// Create inventory for a medication
exports.createInventory = catchAsync(async (req, res, next) => {
  // Check if inventory already exists for this medication
  const existingInventory = await Inventory.findOne({ 
    medication: req.body.medication,
    batchNumber: req.body.batchNumber
  });
  
  if (existingInventory) {
    return next(new AppError('Inventory with this batch number already exists for this medication', 400));
  }
  
  const newInventory = await Inventory.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      inventory: newInventory
    }
  });
});

// Get all inventory items
exports.getAllInventory = catchAsync(async (req, res, next) => {
  // Apply filters if provided
  const filter = {};
  if (req.query.medication) filter.medication = req.query.medication;
  if (req.query.lowStock === 'true') {
    filter.currentQuantity = { $lt: req.query.threshold || 10 };
  }
  if (req.query.expired === 'true') {
    filter.expiryDate = { $lt: new Date() };
  }
  
  const inventory = await Inventory.find(filter)
    .populate('medication', 'name dosageForm strength category');
  
  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: {
      inventory
    }
  });
});

// Get a specific inventory item
exports.getInventoryItem = catchAsync(async (req, res, next) => {
  const inventory = await Inventory.findById(req.params.id)
    .populate('medication', 'name dosageForm strength category description');
  
  if (!inventory) {
    return next(new AppError('No inventory found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

// Update inventory
exports.updateInventory = catchAsync(async (req, res, next) => {
  const inventory = await Inventory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  if (!inventory) {
    return next(new AppError('No inventory found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

// Delete inventory
exports.deleteInventory = catchAsync(async (req, res, next) => {
  const inventory = await Inventory.findByIdAndDelete(req.params.id);
  
  if (!inventory) {
    return next(new AppError('No inventory found with that ID', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Adjust inventory quantity (for dispensing or receiving stock)
exports.adjustInventory = catchAsync(async (req, res, next) => {
  const { adjustment, reason } = req.body;
  
  // Find the inventory
  const inventory = await Inventory.findById(req.params.id);
  
  if (!inventory) {
    return next(new AppError('No inventory found with that ID', 404));
  }
  
  // Calculate new quantity
  const newQuantity = inventory.currentQuantity + adjustment;
  
  // Don't allow negative quantities
  if (newQuantity < 0) {
    return next(new AppError('Inventory quantity cannot be negative', 400));
  }
  
  // Update the inventory
  inventory.currentQuantity = newQuantity;
  
  // Add transaction record
  inventory.transactions.push({
    adjustment,
    reason,
    performedBy: req.user.id,
    date: Date.now()
  });
  
  await inventory.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

// Get low stock alerts
exports.getLowStockAlerts = catchAsync(async (req, res, next) => {
  const threshold = req.query.threshold || 10;
  
  const lowStock = await Inventory.find({
    currentQuantity: { $lt: threshold }
  }).populate('medication', 'name dosageForm strength category');
  
  res.status(200).json({
    status: 'success',
    results: lowStock.length,
    data: {
      lowStock
    }
  });
});

// Get expiring medication alerts
exports.getExpiringAlerts = catchAsync(async (req, res, next) => {
  // Default to 3 months from now
  const monthsAhead = req.query.months || 3;
  const expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + parseInt(monthsAhead));
  
  const expiring = await Inventory.find({
    expiryDate: { $lt: expiryDate, $gt: new Date() }
  }).populate('medication', 'name dosageForm strength category');
  
  res.status(200).json({
    status: 'success',
    results: expiring.length,
    data: {
      expiring
    }
  });
});

// ================= PRESCRIPTION PROCESSING =================

// Get pending prescriptions for pharmacy
exports.getPendingPrescriptions = catchAsync(async (req, res, next) => {
  const prescriptions = await Prescription.find({ status: 'pending' })
    .populate('patient', 'name contactNumber')
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

// Process a prescription
exports.processPrescription = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  const prescription = await Prescription.findById(id)
    .populate('medications.medication');
  
  if (!prescription) {
    return next(new AppError('No prescription found with that ID', 404));
  }
  
  // If marking as filled, check inventory and adjust quantities
  if (status === 'filled') {
    // For each medication in the prescription
    for (const med of prescription.medications) {
      const { medication, quantity, dosage } = med;
      
      // Find suitable inventory
      const inventory = await Inventory.findOne({
        medication: medication._id,
        currentQuantity: { $gte: quantity },
        expiryDate: { $gt: new Date() }
      }).sort('expiryDate');
      
      if (!inventory) {
        return next(new AppError(`Insufficient stock for ${medication.name}`, 400));
      }
      
      // Adjust inventory
      inventory.currentQuantity -= quantity;
      inventory.transactions.push({
        adjustment: -quantity,
        reason: `Dispensed for prescription #${prescription._id}`,
        performedBy: req.user.id,
        date: Date.now()
      });
      
      await inventory.save();
    }
  }
  
  // Update prescription status
  prescription.status = status;
  prescription.dispensingNotes = notes || '';
  prescription.dispensedBy = req.user.id;
  prescription.dispensedAt = Date.now();
  
  await prescription.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      prescription
    }
  });
});

// Search medications by name, category, or strength
exports.searchMedications = catchAsync(async (req, res, next) => {
  const { query } = req.query;
  
  if (!query) {
    return next(new AppError('Search query is required', 400));
  }
  
  const medications = await Medication.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { category: { $regex: query, $options: 'i' } },
      { strength: { $regex: query, $options: 'i' } }
    ]
  });
  
  res.status(200).json({
    status: 'success',
    results: medications.length,
    data: {
      medications
    }
  });
});

// Get medication by barcode
exports.getMedicationByBarcode = catchAsync(async (req, res, next) => {
  const { barcode } = req.params;
  
  const medication = await Medication.findOne({ barcode });
  
  if (!medication) {
    return next(new AppError('No medication found with that barcode', 404));
  }
  
  // Get inventory for this medication
  const inventory = await Inventory.find({ 
    medication: medication._id,
    currentQuantity: { $gt: 0 },
    expiryDate: { $gt: new Date() }
  }).sort('expiryDate');
  
  res.status(200).json({
    status: 'success',
    data: {
      medication,
      inventory
    }
  });
});

// Get medication alternatives (same active ingredient)
exports.getMedicationAlternatives = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const medication = await Medication.findById(id);
  
  if (!medication) {
    return next(new AppError('No medication found with that ID', 404));
  }
  
  const alternatives = await Medication.find({
    activeIngredient: medication.activeIngredient,
    _id: { $ne: medication._id }
  });
  
  res.status(200).json({
    status: 'success',
    results: alternatives.length,
    data: {
      alternatives
    }
  });
});

// Check medication interactions
exports.checkMedicationInteractions = catchAsync(async (req, res, next) => {
  const { medications } = req.body;
  
  if (!medications || !Array.isArray(medications) || medications.length < 2) {
    return next(new AppError('At least two medication IDs are required', 400));
  }
  
  // Fetch all medications
  const medicationDocs = await Medication.find({
    _id: { $in: medications }
  });
  
  // Check for interactions (simplified - in real app would use a drug interaction database)
  const interactions = [];
  
  // Simple example checking contraindications
  for (let i = 0; i < medicationDocs.length; i++) {
    for (let j = i + 1; j < medicationDocs.length; j++) {
      const med1 = medicationDocs[i];
      const med2 = medicationDocs[j];
      
      // Check if med2 is in med1's contraindications or vice versa
      if (med1.contraindications && med1.contraindications.includes(med2.activeIngredient)) {
        interactions.push({
          medications: [med1._id, med2._id],
          description: `${med1.name} should not be taken with ${med2.name} (${med2.activeIngredient} is contraindicated)`
        });
      }
      
      if (med2.contraindications && med2.contraindications.includes(med1.activeIngredient)) {
        interactions.push({
          medications: [med1._id, med2._id],
          description: `${med2.name} should not be taken with ${med1.name} (${med1.activeIngredient} is contraindicated)`
        });
      }
    }
  }
  
  res.status(200).json({
    status: 'success',
    results: interactions.length,
    data: {
      interactions
    }
  });
});

// Generate inventory report
exports.generateInventoryReport = catchAsync(async (req, res, next) => {
  const { category, expiryBefore, lowStock } = req.query;
  
  const filter = {};
  
  if (category) {
    // First get all medications in this category
    const medications = await Medication.find({ category });
    const medicationIds = medications.map(med => med._id);
    
    filter.medication = { $in: medicationIds };
  }
  
  if (expiryBefore) {
    filter.expiryDate = { $lt: new Date(expiryBefore) };
  }
  
  if (lowStock === 'true') {
    filter.currentQuantity = { $lt: req.query.threshold || 10 };
  }
  
  const inventory = await Inventory.find(filter)
    .populate('medication', 'name dosageForm strength category price')
    .sort('expiryDate');
  
  // Calculate total value
  let totalValue = 0;
  inventory.forEach(item => {
    if (item.medication && item.medication.price) {
      totalValue += item.currentQuantity * item.medication.price;
    }
  });
  
  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: {
      inventory,
      totalValue,
      reportDate: new Date()
    }
  });
});