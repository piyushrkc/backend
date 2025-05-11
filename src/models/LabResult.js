const mongoose = require('mongoose');

const labResultSchema = new mongoose.Schema({
  labTest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest',
    required: [true, 'Lab result must be associated with a lab test']
  },
  results: [{
    parameter: {
      type: String,
      required: [true, 'Parameter name is required']
    },
    value: {
      type: String,
      required: [true, 'Result value is required']
    },
    unit: String,
    referenceRange: String,
    interpretation: {
      type: String,
      enum: ['normal', 'low', 'high', 'abnormal', 'critical']
    },
    notes: String
  }],
  summary: String,
  interpretation: String,
  recommendations: String,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Lab result must have an entry person']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  attachments: [{
    fileName: String,
    fileType: String,
    filePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notified: {
    patient: {
      type: Boolean,
      default: false
    },
    doctor: {
      type: Boolean,
      default: false
    },
    notifiedAt: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
labResultSchema.index({ labTest: 1 });

// Update notification status when setting as notified
labResultSchema.pre('save', function(next) {
  if (this.isModified('notified.patient') || this.isModified('notified.doctor')) {
    if (this.notified.patient || this.notified.doctor) {
      this.notified.notifiedAt = Date.now();
    }
  }
  next();
});

const LabResult = mongoose.model('LabResult', labResultSchema);

module.exports = LabResult;