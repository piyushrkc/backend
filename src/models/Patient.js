const mongoose = require('mongoose');
const crypto = require('crypto');

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    unique: true,
    default: function() {
      // Generate a 5-digit random number for UHID
      return 'UHID-' + Math.floor(10000 + Math.random() * 90000);
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient must be linked to a user account']
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required']
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'],
    default: 'unknown'
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  allergies: [String],
  chronicDiseases: [String],
  medicalHistory: [{
    condition: String,
    diagnosedDate: Date,
    treatment: String,
    notes: String
  }],
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    validUntil: Date
  },
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  }],
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  }],
  labTests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest'
  }],
  bills: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Calculate age virtually
patientSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return null;
  
  const today = new Date();
  const birthDate = new Date(this.dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
});

// Create indexes for frequently queried fields
patientSchema.index({ patientId: 1 }, { unique: true });
patientSchema.index({ user: 1 });
patientSchema.index({ 'insuranceInfo.provider': 1 });
patientSchema.index({ 'insuranceInfo.policyNumber': 1 });
patientSchema.index({ bloodGroup: 1 });
patientSchema.index({ 'address.city': 1 });
patientSchema.index({ 'address.zipCode': 1 });
patientSchema.index({ allergies: 1 });
patientSchema.index({ chronicDiseases: 1 });
patientSchema.index({ dateOfBirth: 1 });

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;