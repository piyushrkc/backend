// src/models/BillingSettings.js
const mongoose = require('mongoose');

const billingSettingsSchema = new mongoose.Schema({
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital is required'],
    unique: true
  },
  consultationFees: {
    standard: {
      type: Number,
      default: 500
    },
    followUp: {
      type: Number,
      default: 300
    },
    specialist: {
      type: Number,
      default: 1000
    },
    emergency: {
      type: Number,
      default: 1500
    }
  },
  gstNumber: {
    type: String,
    trim: true,
    default: '29AADCB2230M1ZP'
  },
  gstPercentage: {
    type: Number,
    default: 18
  },
  currency: {
    type: String,
    default: '₹',
    trim: true
  },
  paymentMethods: {
    type: [String],
    default: ['Cash']
  },
  invoicePrefix: {
    type: String,
    default: 'INV',
    trim: true
  },
  termsAndConditions: {
    type: String,
    trim: true,
    default: '1. Payment is due at the time of service.\n2. Reports will be available within 24 hours of testing.\n3. Prescription refills require 48 hours notice.\n4. Missed appointments without 24 hours notice may be charged.'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const BillingSettings = mongoose.model('BillingSettings', billingSettingsSchema);

module.exports = BillingSettings;