const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  maxAppointments: {
    type: Number,
    default: 10
  }
});

const doctorSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Doctor must be linked to a user account']
  },
  specialization: {
    type: String,
    required: [true, 'Specialization is required']
  },
  qualifications: [{
    degree: String,
    institution: String,
    year: Number
  }],
  licenseNumber: {
    type: String,
    required: [true, 'License number is required'],
    unique: true
  },
  experience: {
    type: Number,
    default: 0
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  consultationFee: {
    type: Number,
    required: [true, 'Consultation fee is required']
  },
  availability: {
    type: Boolean,
    default: true
  },
  availabilitySlots: [availabilitySlotSchema],
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient'
  }],
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  ratings: [{
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    review: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes for frequently queried fields
doctorSchema.index({ user: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ department: 1 });
doctorSchema.index({ hospital: 1 });
doctorSchema.index({ licenseNumber: 1 });
doctorSchema.index({ 'ratings.rating': 1 });
doctorSchema.index({ averageRating: -1 });
doctorSchema.index({ hospital: 1, specialization: 1 });
doctorSchema.index({ hospital: 1, department: 1 });

// Calculate average rating when a new rating is added
doctorSchema.pre('save', function(next) {
  if (this.ratings.length > 0) {
    const totalRating = this.ratings.reduce((acc, curr) => acc + curr.rating, 0);
    this.averageRating = totalRating / this.ratings.length;
  }
  next();
});

const Doctor = mongoose.model('Doctor', doctorSchema);

module.exports = Doctor;