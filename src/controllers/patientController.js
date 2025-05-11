// backend/src/controllers/patientController.js
const User = require('../models/User');
const mongoose = require('mongoose');

// Get all patients
exports.getPatients = async (req, res) => {
  try {
    const { 
      search, 
      sortBy = 'lastName', 
      sortOrder = 'asc', 
      page = 1, 
      limit = 10 
    } = req.query;
    
    // Base query - only get patients from the current hospital
    const query = { 
      role: 'patient',
      hospital: req.user.hospital
    };
    
    // Add search functionality
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Define sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const patients = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalPatients = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: patients.length,
      total: totalPatients,
      totalPages: Math.ceil(totalPatients / limit),
      currentPage: parseInt(page),
      patients
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patients',
      error: error.message
    });
  }
};

// Get patient by ID
exports.getPatientById = async (req, res) => {
  try {
    const patient = await User.findOne({
      _id: req.params.id,
      role: 'patient',
      hospital: req.user.hospital
    }).select('-password');
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    res.status(200).json({
      success: true,
      patient
    });
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient',
      error: error.message
    });
  }
};

// Create patient (admin and receptionist only)
exports.createPatient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      medicalHistory
    } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already in use'
      });
    }
    
    // Create new patient
    const patient = new User({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      role: 'patient',
      hospital: req.user.hospital,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      medicalHistory
    });
    
    await patient.save();
    
    // Remove password from response
    const patientResponse = patient.toObject();
    delete patientResponse.password;
    
    res.status(201).json({
      success: true,
      message: 'Patient created successfully',
      patient: patientResponse
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create patient',
      error: error.message
    });
  }
};

// Update patient
exports.updatePatient = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      medicalHistory,
      isActive
    } = req.body;
    
    // Find patient
    const patient = await User.findOne({
      _id: req.params.id,
      role: 'patient',
      hospital: req.user.hospital
    });
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // Update fields
    if (firstName) patient.firstName = firstName;
    if (lastName) patient.lastName = lastName;
    if (phoneNumber) patient.phoneNumber = phoneNumber;
    if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
    if (gender) patient.gender = gender;
    if (address) patient.address = address;
    if (emergencyContact) patient.emergencyContact = emergencyContact;
    if (medicalHistory) patient.medicalHistory = medicalHistory;
    if (isActive !== undefined) patient.isActive = isActive;
    
    await patient.save();
    
    // Remove password from response
    const patientResponse = patient.toObject();
    delete patientResponse.password;
    
    res.status(200).json({
      success: true,
      message: 'Patient updated successfully',
      patient: patientResponse
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update patient',
      error: error.message
    });
  }
};

// Delete patient (admin only)
exports.deletePatient = async (req, res) => {
  try {
    // Only allow admins to delete patients
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete patients'
      });
    }
    
    const patient = await User.findOneAndDelete({
      _id: req.params.id,
      role: 'patient',
      hospital: req.user.hospital
    });
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete patient',
      error: error.message
    });
  }
};

// Get patient medical history
exports.getPatientMedicalHistory = async (req, res) => {
  try {
    const patientId = req.params.id;
    
    // Check if patient exists
    const patient = await User.findOne({
      _id: patientId,
      role: 'patient',
      hospital: req.user.hospital
    }).select('-password');
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }
    
    // This function assumes you have medical history fields in User model
    // If medical history is stored in a separate collection, you'd query that instead
    
    res.status(200).json({
      success: true,
      patientInfo: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender
      },
      medicalHistory: patient.medicalHistory || {}
    });
  } catch (error) {
    console.error('Error fetching patient medical history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient medical history',
      error: error.message
    });
  }
};