const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Appointment must belong to a patient']
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Appointment must be with a doctor']
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Appointment must be associated with a hospital']
  },
  appointmentDate: {
    type: Date,
    required: [true, 'Appointment date is required']
  },
  appointmentTime: {
    type: String, // HH:MM format
    required: [true, 'Appointment time is required']
  },
  scheduledTime: Date, // Combination of date and time
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'scheduled'
  },
  type: {
    type: String,
    enum: ['regular', 'follow-up', 'emergency', 'teleconsultation'],
    default: 'regular'
  },
  isTelemedicine: {
    type: Boolean,
    default: function() {
      return this.type === 'teleconsultation';
    }
  },
  telemedicineSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelemedicineSession'
  },
  reason: {
    type: String,
    required: [true, 'Reason for appointment is required']
  },
  notes: String,
  symptoms: [String],
  diagnosis: String,
  startTime: Date, // Actual start time of appointment
  endTime: Date, // Actual end time of appointment
  duration: Number, // In minutes
  followUpRecommended: {
    type: Boolean,
    default: false
  },
  followUpDate: Date,
  cancelled: {
    by: {
      type: String,
      enum: ['patient', 'doctor', 'admin']
    },
    reason: String,
    at: Date
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
// Basic indexes for appointment lookup
appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index({ doctor: 1, appointmentDate: -1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });
appointmentSchema.index({ status: 1 });

// Compound indexes for common query patterns
appointmentSchema.index({ doctor: 1, appointmentDate: 1, startTime: 1 });
appointmentSchema.index({ hospital: 1, appointmentDate: 1 });
appointmentSchema.index({ hospital: 1, status: 1, appointmentDate: -1 });
appointmentSchema.index({ createdAt: -1 });
appointmentSchema.index({ hospital: 1, appointmentDate: 1, startTime: 1, status: 1 });
appointmentSchema.index({ doctor: 1, status: 1, appointmentDate: 1 });
appointmentSchema.index({ patient: 1, status: 1, appointmentDate: 1 });
appointmentSchema.index({ scheduledTime: 1 });

// Calculate scheduledTime from appointmentDate and appointmentTime
appointmentSchema.pre('save', function(next) {
  if (this.appointmentDate && this.appointmentTime) {
    const [hours, minutes] = this.appointmentTime.split(':').map(Number);
    const scheduledDate = new Date(this.appointmentDate);
    scheduledDate.setHours(hours, minutes, 0, 0);
    this.scheduledTime = scheduledDate;
  }
  next();
});

// Calculate duration if appointment is completed
appointmentSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    const duration = (this.endTime - this.startTime) / (1000 * 60); // in minutes
    this.duration = Math.round(duration);
  }
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;