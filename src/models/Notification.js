const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Notification must have a recipient']
  },
  title: {
    type: String,
    required: [true, 'Notification title is required']
  },
  content: {
    type: String,
    required: [true, 'Notification content is required']
  },
  type: {
    type: String,
    enum: ['appointment', 'prescription', 'lab_result', 'payment', 'medication_reminder', 'system', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  link: String,
  image: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  relatedResource: {
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedResource.resourceType'
    },
    resourceType: {
      type: String,
      enum: ['Appointment', 'Prescription', 'LabTest', 'Bill', 'Payment']
    }
  },
  scheduled: {
    type: Boolean,
    default: false
  },
  scheduledFor: Date,
  expiresAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ scheduled: 1, scheduledFor: 1 });

// Set expiry date if not provided
notificationSchema.pre('save', function(next) {
  if (this.isNew && !this.expiresAt) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30); // Default expiry after 30 days
    this.expiresAt = expiry;
  }
  next();
});

// Update readAt when marked as read
notificationSchema.pre('save', function(next) {
  if (this.isModified('read') && this.read) {
    this.readAt = Date.now();
  }
  next();
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;