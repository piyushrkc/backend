// src/controllers/userController.js
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');

// Create a user with associated doctor or patient profile
exports.createUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      role,
      hospitalId,
      specialization,
      licenseNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      // Doctor specific fields
      qualifications,
      experience,
      consultationFee,
      department,
      bio,
      // Patient specific fields
      bloodGroup,
      allergies,
      chronicDiseases,
      medicalHistory,
      insuranceInfo
    } = req.body;

    // Create base user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      role,
      hospital: hospitalId,
      specialization,
      licenseNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact
    });

    await user.save();

    // Create role-specific profile
    let profile;
    
    if (role === 'doctor') {
      profile = new Doctor({
        user: user._id,
        qualifications,
        experience,
        consultationFee,
        department,
        bio
      });
    } else if (role === 'patient') {
      profile = new Patient({
        user: user._id,
        bloodGroup,
        allergies,
        chronicDiseases,
        medicalHistory,
        insuranceInfo
      });
    }

    // Save profile if created
    if (profile) {
      await profile.save();
    }

    // Generate JWT token
    const token = user.generateToken();

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: user.toJSON(),
      profile: profile ? profile.toJSON() : null
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// Get all users with filtering
exports.getUsers = async (req, res) => {
  try {
    const { 
      role, 
      search, 
      isActive = true, 
      page = 1, 
      limit = 10 
    } = req.query;
    
    // Build query
    const query = { hospital: req.user.hospitalId };
    
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
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
    
    // Execute query
    const users = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get user by ID with associated profile
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      hospital: req.user.hospitalId
    }).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get associated profile based on role
    let profile = null;
    
    if (user.role === 'doctor') {
      profile = await Doctor.findOne({ user: user._id });
    } else if (user.role === 'patient') {
      profile = await Patient.findOne({ user: user._id });
    }
    
    res.status(200).json({
      success: true,
      user,
      profile
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      hospital: req.user.hospitalId
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update user fields
    const {
      firstName,
      lastName,
      phoneNumber,
      address,
      emergencyContact,
      isActive,
      // Don't allow role change here for security
      // Don't update email here - should be a separate process with verification
      // Don't update password here - should be a separate process
    } = req.body;
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (address) user.address = address;
    if (emergencyContact) user.emergencyContact = emergencyContact;
    if (isActive !== undefined) user.isActive = isActive;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: user.toJSON()
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    // Only allow admins to delete users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete users'
      });
    }
    
    const user = await User.findOne({
      _id: req.params.id,
      hospital: req.user.hospitalId
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Delete associated profile based on role
    if (user.role === 'doctor') {
      await Doctor.findOneAndDelete({ user: user._id });
    } else if (user.role === 'patient') {
      await Patient.findOneAndDelete({ user: user._id });
    }
    
    // Delete user
    await User.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};
// Add this method to src/controllers/userController.js

// Get user's role-specific profile
exports.getUserProfile = async (req, res) => {
    try {
      const userId = req.params.id || req.user.userId;
      
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      let profile = null;
      
      // Get role-specific profile
      if (user.role === 'doctor') {
        profile = await Doctor.findOne({ user: user._id })
          .populate('qualifications')
          .populate('availabilitySlots');
      } else if (user.role === 'patient') {
        profile = await Patient.findOne({ user: user._id })
          .populate('medicalHistory')
          .populate('allergies')
          .populate('prescriptions', 'status createdAt');
      }
      
      res.status(200).json({
        success: true,
        data: {
          user,
          profile
        }
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile',
        error: error.message
      });
    }
  };
// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user.userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};