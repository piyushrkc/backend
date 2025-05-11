// src/controllers/appointmentController.js
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { paginationMetadata } = require('../middleware/pagination');

// Get all appointments with filtering options
exports.getAppointments = async (req, res) => {
  try {
    const { doctorId, patientId, date, status, startDate, endDate } = req.query;
    
    // Get pagination data from middleware
    const { page, limit, skip, sort, projection } = req.pagination;

    // Base query object
    const query = { hospital: req.user.hospitalId };

    // Add filters if provided - use proper type casting
    if (doctorId) query.doctor = mongoose.Types.ObjectId(doctorId);
    if (patientId) query.patient = mongoose.Types.ObjectId(patientId);
    if (status) {
      // Allow for multiple status values
      const statusValues = status.split(',');
      query.status = statusValues.length > 1 ? { $in: statusValues } : status;
    }
    
    // Filter by specific date
    if (date) {
      const searchDate = new Date(date);
      if (isNaN(searchDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format'
        });
      }
      
      query.appointmentDate = {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
      };
    }
    
    // Filter by date range
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date range format'
        });
      }
      
      query.appointmentDate = {
        $gte: new Date(startDateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(endDateObj.setHours(23, 59, 59, 999))
      };
    }

    // Role-based access control
    if (req.user.role === 'patient') {
      query.patient = mongoose.Types.ObjectId(req.user.userId);
    } else if (req.user.role === 'doctor') {
      query.doctor = mongoose.Types.ObjectId(req.user.userId);
    }
    
    // Set default sort if not provided
    const sortOptions = sort || { appointmentDate: 1, startTime: 1 };
    
    // Use Promise.all to run queries in parallel
    const [appointments, totalAppointments] = await Promise.all([
      Appointment.find(query, projection)
        .populate('patient', 'firstName lastName email phoneNumber')
        .populate('doctor', 'firstName lastName specialization')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(), // Use lean() for better performance when you don't need Mongoose documents
      
      Appointment.countDocuments(query)
    ]);
    
    // Get pagination metadata
    const pagination = paginationMetadata(totalAppointments, req.pagination);
    
    // Add pagination metadata to response
    res.status(200).json({
      success: true,
      pagination,
      data: appointments
    });
  } catch (error) {
    logger.error('Error fetching appointments', { error, userId: req.user?.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

// Get appointment by ID
exports.getAppointmentById = async (req, res) => {
  try {
    // Validate appointment ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid appointment ID format'
      });
    }
    
    // Only select the fields we need for better performance
    const fieldsToSelect = req.query.fields ? 
      req.query.fields.split(',').join(' ') : 
      '';

    // Use projection to improve query performance if fields are specified
    const appointment = await Appointment.findById(
      req.params.id, 
      fieldsToSelect
    )
      .populate('patient', 'firstName lastName email phoneNumber profileImage')
      .populate('doctor', 'firstName lastName specialization profileImage')
      .populate('createdBy', 'firstName lastName')
      .lean(); // Use lean() for better performance
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if user has permission to view the appointment
    if (
      (req.user.role === 'patient' && appointment.patient._id.toString() !== req.user.userId) &&
      (req.user.role === 'doctor' && appointment.doctor._id.toString() !== req.user.userId) &&
      req.user.role !== 'admin' && 
      req.user.role !== 'receptionist'
    ) {
      logger.warn('Unauthorized appointment access attempt', {
        userId: req.user.userId,
        appointmentId: req.params.id,
        userRole: req.user.role
      });
      
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      appointment
    });
  } catch (error) {
    logger.error('Error fetching appointment', { 
      error, 
      appointmentId: req.params.id,
      userId: req.user?.userId 
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment',
      error: error.message
    });
  }
};

// Create new appointment
exports.createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      patientId,
      appointmentDate,
      startTime,
      endTime,
      reason,
      notes,
      priority,
      isFollowUp,
      previousAppointment
    } = req.body;

    // Check if patient and doctor exist and are valid
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or inactive'
      });
    }

    // Check if patientId is provided or use currently logged in user
    let finalPatientId = patientId;
    if (!finalPatientId && req.user.role === 'patient') {
      finalPatientId = req.user.userId;
    }

    const patient = await User.findOne({ _id: finalPatientId, role: 'patient', isActive: true });
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found or inactive'
      });
    }

    // Check for double booking
    const appointmentDateObj = new Date(appointmentDate);
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate: {
        $gte: new Date(appointmentDateObj.setHours(0, 0, 0, 0)),
        $lt: new Date(appointmentDateObj.setHours(23, 59, 59, 999))
      },
      startTime: startTime,
      status: { $nin: ['canceled', 'no-show'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'Doctor already has an appointment scheduled at this time'
      });
    }

    // Create new appointment
    const appointment = new Appointment({
      patient: finalPatientId,
      doctor: doctorId,
      hospital: req.user.hospitalId,
      appointmentDate,
      startTime,
      endTime,
      reason,
      notes,
      priority: priority || 'normal',
      isFollowUp: isFollowUp || false,
      previousAppointment: isFollowUp ? previousAppointment : null,
      createdBy: req.user.userId
    });

    await appointment.save();

    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appointment',
      error: error.message
    });
  }
};

// Update appointment
exports.updateAppointment = async (req, res) => {
  try {
    const {
      appointmentDate,
      startTime,
      endTime,
      status,
      reason,
      notes,
      priority
    } = req.body;

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permission to update
    if (
      req.user.role === 'patient' && appointment.patient.toString() !== req.user.userId &&
      req.user.role === 'doctor' && appointment.doctor.toString() !== req.user.userId &&
      req.user.role !== 'admin' && req.user.role !== 'receptionist'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this appointment'
      });
    }

    // Check for double booking if date or time is being changed
    if ((appointmentDate && appointmentDate !== appointment.appointmentDate.toISOString().split('T')[0]) || 
        (startTime && startTime !== appointment.startTime)) {
      
      const appointmentDateObj = new Date(appointmentDate || appointment.appointmentDate);
      const existingAppointment = await Appointment.findOne({
        _id: { $ne: appointment._id }, // exclude current appointment
        doctor: appointment.doctor,
        appointmentDate: {
          $gte: new Date(appointmentDateObj.setHours(0, 0, 0, 0)),
          $lt: new Date(appointmentDateObj.setHours(23, 59, 59, 999))
        },
        startTime: startTime || appointment.startTime,
        status: { $nin: ['canceled', 'no-show'] }
      });

      if (existingAppointment) {
        return res.status(400).json({
          success: false,
          message: 'Doctor already has an appointment scheduled at this time'
        });
      }
    }

    // Update fields
    if (appointmentDate) appointment.appointmentDate = appointmentDate;
    if (startTime) appointment.startTime = startTime;
    if (endTime) appointment.endTime = endTime;
    if (status) appointment.status = status;
    if (reason) appointment.reason = reason;
    if (notes) appointment.notes = notes;
    if (priority) appointment.priority = priority;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
};
// Add these methods to src/controllers/appointmentController.js

// Check for available time slots for a doctor
exports.getAvailableTimeSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    
    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID and date are required'
      });
    }
    
    // Find the doctor
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }
    
    // Get doctor's availability settings from Doctor model
    const doctorProfile = await Doctor.findOne({ user: doctorId });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }
    
    // Get the day of the week for the requested date
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'lowercase' });
    
    // Find the availability slot for the requested day
    const availabilitySlot = doctorProfile.availabilitySlots.find(slot => slot.day === dayOfWeek);
    
    if (!availabilitySlot || !availabilitySlot.isAvailable) {
      return res.status(200).json({
        success: true,
        message: 'Doctor is not available on this day',
        availableSlots: []
      });
    }
    
    // Parse start and end times
    const [startHour, startMinute] = availabilitySlot.startTime.split(':').map(Number);
    const [endHour, endMinute] = availabilitySlot.endTime.split(':').map(Number);
    
    // Create time slots (assuming 30-minute appointments)
    const slots = [];
    const slotDuration = 30; // in minutes
    const dateObj = new Date(date);
    
    // Set the start time
    dateObj.setHours(startHour, startMinute, 0, 0);
    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    // Generate all possible time slots
    while (dateObj < endTime) {
      const slotStart = new Date(dateObj);
      
      // Add the slot duration
      dateObj.setMinutes(dateObj.getMinutes() + slotDuration);
      
      if (dateObj <= endTime) {
        slots.push({
          startTime: slotStart.toTimeString().substring(0, 5),
          endTime: dateObj.toTimeString().substring(0, 5)
        });
      }
    }
    
    // Check for existing appointments to exclude booked slots
    const existingAppointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: {
        $gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(date).setHours(23, 59, 59, 999))
      },
      status: { $nin: ['canceled', 'no-show'] }
    }).select('startTime endTime');
    
    // Filter out booked slots
    const availableSlots = slots.filter(slot => {
      return !existingAppointments.some(appointment => 
        appointment.startTime === slot.startTime
      );
    });
    
    res.status(200).json({
      success: true,
      data: {
        availableSlots
      }
    });
  } catch (error) {
    console.error('Error getting available time slots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available time slots',
      error: error.message
    });
  }
};

// Check for scheduling conflicts
exports.checkSchedulingConflict = async (req, res) => {
  try {
    const { doctorId, appointmentDate, startTime, endTime, appointmentId } = req.body;
    
    if (!doctorId || !appointmentDate || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID, appointment date, and start time are required'
      });
    }
    
    // Build query to find conflicting appointments
    const query = {
      doctor: doctorId,
      appointmentDate: {
        $gte: new Date(new Date(appointmentDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(appointmentDate).setHours(23, 59, 59, 999))
      },
      startTime: startTime,
      status: { $nin: ['canceled', 'no-show'] }
    };
    
    // Exclude current appointment if updating
    if (appointmentId) {
      query._id = { $ne: appointmentId };
    }
    
    const existingAppointment = await Appointment.findOne(query);
    
    if (existingAppointment) {
      return res.status(200).json({
        success: true,
        hasConflict: true,
        message: 'The selected time slot is already booked'
      });
    }
    
    res.status(200).json({
      success: true,
      hasConflict: false,
      message: 'The selected time slot is available'
    });
  } catch (error) {
    console.error('Error checking scheduling conflict:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check scheduling conflict',
      error: error.message
    });
  }
};
// Cancel appointment
exports.cancelAppointment = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permission to cancel
    if (
      req.user.role === 'patient' && appointment.patient.toString() !== req.user.userId &&
      req.user.role === 'doctor' && appointment.doctor.toString() !== req.user.userId &&
      req.user.role !== 'admin' && req.user.role !== 'receptionist'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this appointment'
      });
    }

    // Can't cancel completed appointments
    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment'
      });
    }

    // Update status and add cancellation note
    appointment.status = 'canceled';
    appointment.notes = appointment.notes 
      ? `${appointment.notes}\n\nCancellation Reason: ${cancellationReason}`
      : `Cancellation Reason: ${cancellationReason}`;

    await appointment.save();

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Delete appointment (admin only)
exports.deleteAppointment = async (req, res) => {
  try {
    // Only admin should be able to delete
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete appointments'
      });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    await Appointment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete appointment',
      error: error.message
    });
  }
};

// Get doctor's schedule/availability
exports.getDoctorSchedule = async (req, res) => {
  try {
    const { doctorId, date, weekStart } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    // Verify that doctor exists
    const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found or inactive'
      });
    }

    let startDate, endDate;

    if (weekStart) {
      // If weekStart provided, get appointments for the whole week
      startDate = new Date(weekStart);
      endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 7);
    } else if (date) {
      // If specific date, get appointments for that day
      startDate = new Date(date);
      endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
    } else {
      // Default to today
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Get all appointments for the doctor in the date range
    const appointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: {
        $gte: startDate,
        $lt: endDate
      },
      status: { $nin: ['canceled', 'no-show'] }
    }).select('appointmentDate startTime endTime status');

    res.status(200).json({
      success: true,
      doctorId,
      timeframe: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      },
      appointments
    });
  } catch (error) {
    console.error('Error fetching doctor schedule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch doctor schedule',
      error: error.message
    });
  }
};

// Get appointment statistics (admin, doctor)
exports.getAppointmentStats = async (req, res) => {
  try {
    // Check permissions
    if (!['admin', 'doctor', 'receptionist'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access appointment statistics'
      });
    }

    const { startDate, endDate, doctorId } = req.query;
    
    // Calculate date range (default to last 30 days if not specified)
    const endDateObj = endDate ? new Date(endDate) : new Date();
    endDateObj.setHours(23, 59, 59, 999);
    
    const startDateObj = startDate ? new Date(startDate) : new Date();
    if (!startDate) {
      startDateObj.setDate(startDateObj.getDate() - 30);
    }
    startDateObj.setHours(0, 0, 0, 0);

    // Base match criteria
    const matchCriteria = {
      hospital: mongoose.Types.ObjectId(req.user.hospitalId),
      appointmentDate: {
        $gte: startDateObj,
        $lte: endDateObj
      }
    };

    // Add doctor filter if requested and if admin/receptionist
    if (doctorId && ['admin', 'receptionist'].includes(req.user.role)) {
      matchCriteria.doctor = mongoose.Types.ObjectId(doctorId);
    } else if (req.user.role === 'doctor') {
      // If doctor is requesting, only show their appointments
      matchCriteria.doctor = mongoose.Types.ObjectId(req.user.userId);
    }

    // Aggregate to get statistics
    const stats = await Appointment.aggregate([
      { $match: matchCriteria },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }},
      { $project: {
        _id: 0,
        status: '$_id',
        count: 1
      }}
    ]);

    // Get total appointments
    const total = await Appointment.countDocuments(matchCriteria);

    // Get appointments by date for chart
    const appointmentsByDate = await Appointment.aggregate([
      { $match: matchCriteria },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } },
      { $project: {
        _id: 0,
        date: '$_id',
        count: 1
      }}
    ]);

    res.status(200).json({
      success: true,
      timeframe: {
        startDate: startDateObj,
        endDate: endDateObj
      },
      total,
      stats,
      appointmentsByDate
    });
  } catch (error) {
    console.error('Error fetching appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statistics',
      error: error.message
    });
  }
};