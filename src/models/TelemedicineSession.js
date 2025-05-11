// src/models/TelemedicineSession.js
const mongoose = require('mongoose');

const telemedicineSessionSchema = new mongoose.Schema({
  // Link to the appointment
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: [true, 'Appointment reference is required']
  },
  
  // Session details
  roomSid: {
    type: String,
    unique: true,
    sparse: true // Allow null/undefined values to be "unique"
  },
  roomName: {
    type: String,
    required: [true, 'Room name is required']
  },
  
  // Participants tokens and SIDs (stored briefly, then removed after session)
  participantTokens: {
    doctor: String,
    patient: String
  },
  participantSids: {
    doctor: String,
    patient: String
  },
  
  // Session timing
  scheduledStartTime: {
    type: Date,
    required: [true, 'Scheduled start time is required']
  },
  actualStartTime: Date,
  endTime: Date,
  
  // Session duration in minutes (calculated after session)
  duration: Number,
  
  // Session status
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'missed'],
    default: 'scheduled'
  },
  
  // Recording (optional)
  isRecorded: {
    type: Boolean,
    default: false
  },
  recordingUrl: String,
  recordingSid: String,
  
  // Notes and feedback
  doctorNotes: String,
  patientFeedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comments: String
  },
  
  // Technical information for troubleshooting
  techDetails: {
    doctorConnectionQuality: String,
    patientConnectionQuality: String,
    errorLogs: [String]
  },
  
  // Hospital reference
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital reference is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Clean up sensitive data before saving
telemedicineSessionSchema.pre('save', function(next) {
  // If the session is completed or cancelled, remove tokens
  if (this.status === 'completed' || this.status === 'cancelled') {
    this.participantTokens = undefined;
  }
  next();
});

// Calculate duration when session ends
telemedicineSessionSchema.pre('save', function(next) {
  if (this.status === 'completed' && this.actualStartTime && this.endTime) {
    // Calculate duration in minutes
    const durationMs = this.endTime.getTime() - this.actualStartTime.getTime();
    this.duration = Math.round(durationMs / (1000 * 60));
  }
  next();
});

// Indexes for faster queries
telemedicineSessionSchema.index({ appointment: 1 }, { unique: true });
telemedicineSessionSchema.index({ roomSid: 1 });
telemedicineSessionSchema.index({ scheduledStartTime: 1 });
telemedicineSessionSchema.index({ status: 1 });
telemedicineSessionSchema.index({ 'hospital': 1, 'scheduledStartTime': 1 });
telemedicineSessionSchema.index({ 'hospital': 1, 'status': 1 });

const TelemedicineSession = mongoose.model('TelemedicineSession', telemedicineSessionSchema);

module.exports = TelemedicineSession;