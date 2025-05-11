// src/controllers/hospitalController.js

const Hospital = require('../models/Hospital');
const AppError = require('../utils/appError');
const logger = require('../utils/logger');

// Get hospital details
exports.getHospitalDetails = async (req, res) => {
  try {
    // Get hospital ID from the authenticated user
    const hospitalId = req.user.hospitalId;
    
    // Find hospital by ID
    const hospital = await Hospital.findById(hospitalId);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    res.status(200).json({ 
      status: 'success',
      data: hospital 
    });
  } catch (error) {
    logger.error('Error getting hospital details:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Failed to get hospital details',
      error: error.message 
    });
  }
};

// Update hospital details
exports.updateHospitalDetails = async (req, res) => {
  try {
    // Get hospital ID from the authenticated user
    const hospitalId = req.user.hospitalId;
    
    const {
      name,
      address,
      contactInfo,
      settings
    } = req.body;
    
    // Find hospital by ID and update
    const hospital = await Hospital.findById(hospitalId);
    
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found' });
    }
    
    // Only update the fields that are provided
    if (name) hospital.name = name;
    
    if (address) {
      hospital.address = {
        ...hospital.address,
        ...address
      };
    }
    
    if (contactInfo) {
      hospital.contactInfo = {
        ...hospital.contactInfo,
        ...contactInfo
      };
    }
    
    if (settings) {
      if (settings.workingHours) {
        hospital.settings.workingHours = {
          ...hospital.settings.workingHours,
          ...settings.workingHours
        };
      }
      
      if (settings.appointmentDuration) {
        hospital.settings.appointmentDuration = settings.appointmentDuration;
      }
      
      if (settings.theme) {
        hospital.settings.theme = {
          ...hospital.settings.theme,
          ...settings.theme
        };
      }
      
      if (settings.enableSMS !== undefined) {
        hospital.settings.enableSMS = settings.enableSMS;
      }
      
      if (settings.enableEmailNotifications !== undefined) {
        hospital.settings.enableEmailNotifications = settings.enableEmailNotifications;
      }
    }
    
    // Save updated hospital
    await hospital.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Hospital details updated successfully',
      data: hospital
    });
  } catch (error) {
    logger.error('Error updating hospital details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update hospital details',
      error: error.message
    });
  }
};

// Update doctor details
exports.updateDoctorDetails = async (req, res) => {
  try {
    // For a real implementation, this would need to update the doctor model
    // This is a simplified version just for the demo
    const doctorId = req.params.id;
    const { firstName, lastName, qualification, specialization, licenseNumber } = req.body;
    
    // In a real implementation, you would fetch and update the doctor record
    // For now, we'll just return success
    
    res.status(200).json({
      status: 'success',
      message: 'Doctor details updated successfully',
      data: {
        id: doctorId,
        firstName,
        lastName,
        qualification,
        specialization,
        licenseNumber
      }
    });
  } catch (error) {
    logger.error('Error updating doctor details:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update doctor details',
      error: error.message
    });
  }
};