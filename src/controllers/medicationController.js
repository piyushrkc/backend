// backend/src/controllers/medicationController.js
const Medication = require('../models/Medication');
const mongoose = require('mongoose');

// Get all medications
exports.getMedications = async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 10
    } = req.query;
    
    // Base query - only get medications from the current hospital
    const query = { hospital: req.user.hospital };
    
    // Add filters if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { genericName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) query.category = category;
    if (status) query.status = status;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const medications = await Medication.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalMedications = await Medication.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: medications.length,
      total: totalMedications,
      totalPages: Math.ceil(totalMedications / limit),
      currentPage: parseInt(page),
      medications
    });
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medications',
      error: error.message
    });
  }
};

// Get medication by ID
exports.getMedicationById = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      hospital: req.user.hospital
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }
    
    res.status(200).json({
      success: true,
      medication
    });
  } catch (error) {
    console.error('Error fetching medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch medication',
      error: error.message
    });
  }
};

// Create medication (admin, pharmacist)
exports.createMedication = async (req, res) => {
  try {
    const {
      name,
      genericName,
      brand,
      category,
      form,
      strength,
      manufacturer,
      description,
      sideEffects,
      contraindications,
      dosageInstructions,
      inventory,
      pricing,
      suppliers,
      needsPrescription,
      image,
      barcode
    } = req.body;
    
    // Create new medication
    const medication = new Medication({
      name,
      genericName,
      brand,
      category,
      form,
      strength,
      hospital: req.user.hospital,
      manufacturer,
      description,
      sideEffects,
      contraindications,
      dosageInstructions,
      inventory,
      pricing,
      suppliers,
      needsPrescription,
      image,
      barcode
    });
    
    await medication.save();
    
    res.status(201).json({
      success: true,
      message: 'Medication created successfully',
      medication
    });
  } catch (error) {
    console.error('Error creating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create medication',
      error: error.message
    });
  }
};

// Update medication
exports.updateMedication = async (req, res) => {
  try {
    const medication = await Medication.findOne({
      _id: req.params.id,
      hospital: req.user.hospital
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }
    
    // Update fields - dynamically update only provided fields
    const updateFields = req.body;
    Object.keys(updateFields).forEach(key => {
      // Special handling for nested objects
      if (key === 'inventory' || key === 'pricing' || key === 'suppliers') {
        Object.keys(updateFields[key]).forEach(subKey => {
          medication[key][subKey] = updateFields[key][subKey];
        });
      } else {
        medication[key] = updateFields[key];
      }
    });
    
    await medication.save();
    
    res.status(200).json({
      success: true,
      message: 'Medication updated successfully',
      medication
    });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication',
      error: error.message
    });
  }
};

// Delete medication (admin only)
exports.deleteMedication = async (req, res) => {
  try {
    // Only allow admins to delete medications
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete medications'
      });
    }
    
    const medication = await Medication.findOneAndDelete({
      _id: req.params.id,
      hospital: req.user.hospital
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Medication deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting medication:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete medication',
      error: error.message
    });
  }
};

// Update medication inventory
exports.updateInventory = async (req, res) => {
  try {
    const { quantity, action, batchNumber, expiryDate } = req.body;
    
    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "add" or "remove"'
      });
    }
    
    const medication = await Medication.findOne({
      _id: req.params.id,
      hospital: req.user.hospital
    });
    
    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found'
      });
    }
    
    // Update inventory
    if (action === 'add') {
      medication.inventory.currentStock += quantity;
      if (batchNumber) medication.inventory.batchNumber = batchNumber;
      if (expiryDate) medication.inventory.expiryDate = expiryDate;
    } else {
      if (medication.inventory.currentStock < quantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock available'
        });
      }
      medication.inventory.currentStock -= quantity;
    }
    
    await medication.save();
    
    res.status(200).json({
      success: true,
      message: `Inventory ${action === 'add' ? 'added' : 'removed'} successfully`,
      currentStock: medication.inventory.currentStock,
      status: medication.status
    });
  } catch (error) {
    console.error('Error updating medication inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update medication inventory',
      error: error.message
    });
  }
};

// Get low stock medications
exports.getLowStockMedications = async (req, res) => {
  try {
    const medications = await Medication.find({
      hospital: req.user.hospital,
      status: 'low-stock'
    }).sort({ 'inventory.currentStock': 1 });
    
    res.status(200).json({
      success: true,
      count: medications.length,
      medications
    });
  } catch (error) {
    console.error('Error fetching low stock medications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch low stock medications',
      error: error.message
    });
  }
};