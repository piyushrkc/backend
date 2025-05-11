// src/models/RefreshToken.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const refreshTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  revokedAt: {
    type: Date
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Add method to check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return Date.now() >= this.expiresAt;
};

// Add method to revoke token
refreshTokenSchema.methods.revoke = function() {
  this.isRevoked = true;
  this.revokedAt = Date.now();
  return this.save();
};

// Static method to generate a new refresh token
refreshTokenSchema.statics.generateToken = function(userId, ipAddress, userAgent, expiresInDays = 7) {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  
  return this.create({
    token,
    user: userId,
    expiresAt,
    ipAddress,
    userAgent
  });
};

// Static method to find valid token
refreshTokenSchema.statics.findValidToken = function(token) {
  return this.findOne({
    token,
    isRevoked: false,
    expiresAt: { $gt: Date.now() }
  }).populate('user');
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllUserTokens = function(userId) {
  return this.updateMany(
    { user: userId, isRevoked: false },
    { isRevoked: true, revokedAt: Date.now() }
  );
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;