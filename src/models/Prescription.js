const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Prescription must belong to a patient']
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Prescription must be created by a doctor']
  },
  diagnosis: {
    type: String,
    required: [true, 'Diagnosis is required']
  },
  medications: [{
    medication: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medication',
      required: [true, 'Medication reference is required']
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required']
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required']
    },
    duration: {
      type: String,
      required: [true, 'Duration is required']
    },
    instructions: String,
    quantity: {
      type: Number,
      required: [true, 'Quantity is required']
    }
  }],
  instructions: String,
  status: {
    type: String,
    enum: ['pending', 'filled', 'completed', 'denied'],
    default: 'pending'
  },
  dispensingNotes: String,
  dispensedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  dispensedAt: Date,
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  refillable: {
    type: Boolean,
    default: false
  },
  refillsAllowed: {
    type: Number,
    default: 0
  },
  refillsUsed: {
    type: Number,
    default: 0
  },
  validUntil: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
prescriptionSchema.index({ patient: 1, createdAt: -1 });
prescriptionSchema.index({ doctor: 1, createdAt: -1 });
prescriptionSchema.index({ status: 1 });
prescriptionSchema.index({ appointment: 1 });
prescriptionSchema.index({ createdAt: -1 });
prescriptionSchema.index({ validUntil: 1 });
prescriptionSchema.index({ patient: 1, status: 1 });
prescriptionSchema.index({ doctor: 1, status: 1 });
prescriptionSchema.index({ 'medications.medication': 1 });
prescriptionSchema.index({ refillable: 1, refillsAllowed: 1, refillsUsed: 1 });

// Set validUntil date based on creation date if not provided
prescriptionSchema.pre('save', function(next) {
  if (!this.validUntil) {
    const validityDate = new Date(this.createdAt || Date.now());
    validityDate.setDate(validityDate.getDate() + 30); // Valid for 30 days by default
    this.validUntil = validityDate;
  }
  next();
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;