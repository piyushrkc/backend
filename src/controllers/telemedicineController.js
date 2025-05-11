// src/controllers/telemedicineController.js
const TelemedicineSession = require('../models/TelemedicineSession');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const twilioService = require('../services/twilioService');
const logger = require('../utils/logger');

/**
 * Create a new telemedicine session for an appointment
 * @route POST /api/telemedicine/sessions
 * @access Private (Doctor, Admin)
 */
exports.createTelemedicineSession = async (req, res) => {
  try {
    const { appointmentId } = req.body;
    
    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient')
      .populate('doctor');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }
    
    // Check if session already exists for this appointment
    const existingSession = await TelemedicineSession.findOne({ appointment: appointmentId });
    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'Telemedicine session already exists for this appointment',
        data: existingSession
      });
    }
    
    // Ensure appointment is of type teleconsultation
    if (appointment.type !== 'teleconsultation') {
      // Update appointment to telemedicine type
      appointment.type = 'teleconsultation';
      appointment.isTelemedicine = true;
      await appointment.save();
    }
    
    // Generate a unique room name
    const roomName = `appointment-${appointmentId}-${Date.now()}`;
    
    // Create a Twilio room
    const twilioRoom = await twilioService.createRoom(roomName, false);
    
    // Create the telemedicine session
    const session = new TelemedicineSession({
      appointment: appointmentId,
      roomSid: twilioRoom.sid,
      roomName,
      scheduledStartTime: appointment.scheduledTime,
      status: 'scheduled',
      hospital: appointment.hospital
    });
    
    await session.save();
    
    // Update appointment with reference to telemedicine session
    appointment.telemedicineSession = session._id;
    await appointment.save();
    
    res.status(201).json({
      success: true,
      message: 'Telemedicine session created successfully',
      data: session
    });
  } catch (error) {
    logger.error('Error creating telemedicine session:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating telemedicine session',
      error: error.message
    });
  }
};

/**
 * Get a telemedicine session by ID
 * @route GET /api/telemedicine/sessions/:id
 * @access Private (Doctor, Patient with access to the appointment)
 */
exports.getTelemedicineSessionById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const session = await TelemedicineSession.findById(id)
      .populate({
        path: 'appointment',
        populate: [
          { path: 'patient', select: 'user' },
          { path: 'doctor', select: 'user' }
        ]
      });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Telemedicine session not found'
      });
    }
    
    // Check user permission - only doctor, patient, or admin can access
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isDoctor = userRole === 'doctor' && 
                     session.appointment.doctor.user.toString() === userId;
    const isPatient = userRole === 'patient' && 
                      session.appointment.patient.user.toString() === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isDoctor && !isPatient && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this session'
      });
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('Error fetching telemedicine session:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching telemedicine session',
      error: error.message
    });
  }
};

/**
 * Get all telemedicine sessions for the current user
 * @route GET /api/telemedicine/sessions
 * @access Private
 */
exports.getTelemedicineSessions = async (req, res) => {
  try {
    const { status, date, upcoming } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;
    
    // Build query based on user role and filters
    let query = {};
    
    // Add filters
    if (status) {
      query.status = status;
    }
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      query.scheduledStartTime = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    if (upcoming === 'true') {
      query.scheduledStartTime = { $gte: new Date() };
      query.status = { $in: ['scheduled', 'in-progress'] };
    }
    
    // Add user-specific filters
    if (userRole === 'doctor') {
      // Find doctor document with this user
      const doctor = await Doctor.findOne({ user: userId });
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found'
        });
      }
      
      // Find appointments for this doctor
      const appointments = await Appointment.find({ doctor: doctor._id });
      const appointmentIds = appointments.map(a => a._id);
      
      query.appointment = { $in: appointmentIds };
    } else if (userRole === 'patient') {
      // Find patient document with this user
      const patient = await Patient.findOne({ user: userId });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found'
        });
      }
      
      // Find appointments for this patient
      const appointments = await Appointment.find({ patient: patient._id });
      const appointmentIds = appointments.map(a => a._id);
      
      query.appointment = { $in: appointmentIds };
    } else if (userRole !== 'admin') {
      // Other roles don't have access
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view telemedicine sessions'
      });
    }
    
    // Add hospital filter if admin
    if (userRole === 'admin') {
      query.hospital = req.user.hospital;
    }
    
    // Get sessions with populated appointment
    const sessions = await TelemedicineSession.find(query)
      .populate({
        path: 'appointment',
        populate: [
          { path: 'patient', select: 'user', populate: { path: 'user', select: 'firstName lastName' } },
          { path: 'doctor', select: 'user', populate: { path: 'user', select: 'firstName lastName' } }
        ]
      })
      .sort({ scheduledStartTime: 1 });
    
    res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions
    });
  } catch (error) {
    logger.error('Error fetching telemedicine sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching telemedicine sessions',
      error: error.message
    });
  }
};

/**
 * Generate a token for joining a telemedicine session
 * @route POST /api/telemedicine/token
 * @access Private (Doctor, Patient with access to the appointment)
 */
exports.generateToken = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Get the session
    const session = await TelemedicineSession.findById(sessionId)
      .populate({
        path: 'appointment',
        populate: [
          { path: 'patient', select: 'user' },
          { path: 'doctor', select: 'user' }
        ]
      });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Telemedicine session not found'
      });
    }
    
    // Check user permission - only doctor or patient can join
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isDoctor = userRole === 'doctor' && 
                     session.appointment.doctor.user.toString() === userId;
    const isPatient = userRole === 'patient' && 
                      session.appointment.patient.user.toString() === userId;
    
    if (!isDoctor && !isPatient) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to join this session'
      });
    }
    
    // Check if session is in a joinable state
    if (!['scheduled', 'in-progress'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot join session with status: ${session.status}`
      });
    }
    
    // Generate a token for the user
    const identity = userId;
    const roomName = session.roomName;
    
    const token = twilioService.generateToken(identity, roomName, isDoctor);
    
    // Store the token in the session temporarily
    if (isDoctor) {
      session.participantTokens = {
        ...session.participantTokens,
        doctor: token
      };
    } else {
      session.participantTokens = {
        ...session.participantTokens,
        patient: token
      };
    }
    
    // If session is scheduled, mark it as in-progress when the first person joins
    if (session.status === 'scheduled') {
      session.status = 'in-progress';
      session.actualStartTime = new Date();
    }
    
    await session.save();
    
    res.status(200).json({
      success: true,
      data: {
        token,
        identity,
        roomName,
        roomSid: session.roomSid,
        role: isDoctor ? 'doctor' : 'patient'
      }
    });
  } catch (error) {
    logger.error('Error generating token:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating token',
      error: error.message
    });
  }
};

/**
 * End a telemedicine session
 * @route PUT /api/telemedicine/sessions/:id/end
 * @access Private (Doctor, Admin)
 */
exports.endTelemedicineSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const session = await TelemedicineSession.findById(id)
      .populate({
        path: 'appointment',
        populate: { path: 'doctor', select: 'user' }
      });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Telemedicine session not found'
      });
    }
    
    // Only doctor or admin can end a session
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isDoctor = userRole === 'doctor' && 
                     session.appointment.doctor.user.toString() === userId;
    const isAdmin = userRole === 'admin';
    
    if (!isDoctor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to end this session'
      });
    }
    
    // Check if session can be ended
    if (!['in-progress', 'scheduled'].includes(session.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot end session with status: ${session.status}`
      });
    }
    
    // End the Twilio room if it exists
    if (session.roomSid) {
      try {
        await twilioService.endRoom(session.roomSid);
      } catch (error) {
        logger.error(`Error ending Twilio room ${session.roomSid}:`, error);
        // Continue even if Twilio call fails
      }
    }
    
    // Update session status
    session.status = 'completed';
    session.endTime = new Date();
    
    // Add doctor notes if provided
    if (notes) {
      session.doctorNotes = notes;
    }
    
    // Remove tokens for security
    session.participantTokens = undefined;
    
    await session.save();
    
    // Update appointment status to completed
    await Appointment.findByIdAndUpdate(session.appointment._id, {
      status: 'completed',
      endTime: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: 'Telemedicine session ended successfully',
      data: session
    });
  } catch (error) {
    logger.error('Error ending telemedicine session:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending telemedicine session',
      error: error.message
    });
  }
};

/**
 * Handle room status callback from Twilio
 * @route POST /api/telemedicine/room-status-callback
 * @access Public (webhook called by Twilio)
 */
exports.roomStatusCallback = async (req, res) => {
  try {
    const { RoomSid, RoomName, RoomStatus, ParticipantSid, ParticipantIdentity, ParticipantStatus } = req.body;
    
    logger.info(`Received Twilio callback: Room ${RoomName} (${RoomSid}) status: ${RoomStatus}`, {
      participant: ParticipantIdentity ? `${ParticipantIdentity} (${ParticipantSid})` : null,
      participantStatus: ParticipantStatus
    });
    
    // Find the session by roomSid
    const session = await TelemedicineSession.findOne({ roomSid: RoomSid });
    
    if (!session) {
      logger.warn(`Received Twilio callback for unknown room: ${RoomSid}`);
      return res.status(200).send('OK');
    }
    
    // Update session based on room status
    if (RoomStatus === 'in-progress' && session.status === 'scheduled') {
      session.status = 'in-progress';
      session.actualStartTime = new Date();
    } else if (RoomStatus === 'completed' && session.status === 'in-progress') {
      session.status = 'completed';
      session.endTime = new Date();
    }
    
    // Track participant connections
    if (ParticipantIdentity && ParticipantSid) {
      // Find user by id
      const user = await User.findById(ParticipantIdentity);
      
      if (user) {
        // Check if this is a doctor or patient
        const isDoctor = user.role === 'doctor';
        const isPatient = user.role === 'patient';
        
        if (isDoctor || isPatient) {
          const role = isDoctor ? 'doctor' : 'patient';
          
          // Update participant SID
          if (ParticipantStatus === 'connected') {
            session.participantSids = {
              ...session.participantSids,
              [role]: ParticipantSid
            };
          } else if (ParticipantStatus === 'disconnected') {
            // If the participant was disconnected, clear their SID
            if (session.participantSids && session.participantSids[role] === ParticipantSid) {
              session.participantSids[role] = null;
            }
          }
        }
      }
    }
    
    await session.save();
    
    // Return success to Twilio
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing Twilio room status callback:', error);
    // Still return 200 to Twilio to prevent retries
    res.status(200).send('Error processed');
  }
};

/**
 * Submit patient feedback for a telemedicine session
 * @route POST /api/telemedicine/sessions/:id/feedback
 * @access Private (Patient)
 */
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comments } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const session = await TelemedicineSession.findById(id)
      .populate({
        path: 'appointment',
        populate: { path: 'patient', select: 'user' }
      });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Telemedicine session not found'
      });
    }
    
    // Only patient can submit feedback
    const userRole = req.user.role;
    const userId = req.user._id.toString();
    
    const isPatient = userRole === 'patient' && 
                      session.appointment.patient.user.toString() === userId;
    
    if (!isPatient) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to submit feedback for this session'
      });
    }
    
    // Update session with feedback
    session.patientFeedback = {
      rating,
      comments
    };
    
    await session.save();
    
    res.status(200).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: session.patientFeedback
    });
  } catch (error) {
    logger.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
};