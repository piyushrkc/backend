// src/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false
  },
  phoneNumber: String,
  role: {
    type: String,
    enum: ['patient', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant', 'staff', 'admin'],
    default: 'patient'
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  specialization: String,
  licenseNumber: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
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
  profileImage: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  
  // Password reset fields
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save hook to encrypt the password
userSchema.pre('save', async function(next) {
  // Only run this function if password was modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  
  next();
});

// Pre-save hook to update passwordChangedAt
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Pre-find query to filter out inactive users
userSchema.pre(/^find/, function(next) {
  // this points to the current query
  this.find({ isActive: { $ne: false } });
  next();
});

// Instance method to check if password is correct
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Create email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

// Generate JWT token
userSchema.methods.generateToken = function() {
  const jwt = require('jsonwebtoken');
  const config = require('../config/config');
  
  return jwt.sign(
    { userId: this._id, role: this.role, hospitalId: this.hospital },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Create indexes for frequently queried fields
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ hospital: 1, role: 1 });
userSchema.index({ hospital: 1, isActive: 1 });
userSchema.index({ lastName: 1, firstName: 1 });
userSchema.index({ email: 1, hospital: 1 });
userSchema.index({ 'address.city': 1, hospital: 1 });
userSchema.index({ passwordResetToken: 1, passwordResetExpires: 1 });
userSchema.index({ emailVerificationToken: 1, emailVerificationExpires: 1 });

const User = mongoose.model('User', userSchema);

module.exports = User;