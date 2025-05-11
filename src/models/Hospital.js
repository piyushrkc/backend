// src/models/Hospital.js
const mongoose = require('mongoose');

const HospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contactInfo: {
    email: String,
    phone: String,
    website: String
  },
  type: {
    type: String,
    enum: ['private', 'government', 'nonprofit'],
    required: true
  },
  size: {
    type: String,
    enum: ['small', 'medium', 'large'],
    default: 'small'
  },
  logo: {
    type: String
  },
  settings: {
    theme: {
      primaryColor: {
        type: String,
        default: '#0d6efd'
      },
      secondaryColor: {
        type: String,
        default: '#6c757d'
      }
    },
    workingHours: {
      monday: { start: String, end: String },
      tuesday: { start: String, end: String },
      wednesday: { start: String, end: String },
      thursday: { start: String, end: String },
      friday: { start: String, end: String },
      saturday: { start: String, end: String },
      sunday: { start: String, end: String }
    },
    appointmentDuration: {
      type: Number,
      default: 30 // in minutes
    },
    enableSMS: {
      type: Boolean,
      default: false
    },
    enableEmailNotifications: {
      type: Boolean,
      default: true
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'trial'],
      default: 'trial'
    },
    trialEndsAt: Date,
    renewalDate: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Hospital = mongoose.model('Hospital', HospitalSchema);

module.exports = Hospital;