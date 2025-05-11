const mongoose = require('mongoose');

const labTestSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Lab test must belong to a patient']
  },
  testType: {
    type: String,
    required: [true, 'Test type is required']
  },
  testCode: String,
  orderedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Lab test must be ordered by a doctor']
  },
  status: {
    type: String,
    enum: ['ordered', 'collected', 'processing', 'completed', 'cancelled'],
    default: 'ordered'
  },
  priority: {
    type: String,
    enum: ['routine', 'urgent', 'stat'],
    default: 'routine'
  },
  instructions: String,
  requiredFasting: {
    type: Boolean,
    default: false
  },
  sampleCollected: {
    type: Boolean,
    default: false
  },
  sampleType: {
    type: String,
    enum: ['blood', 'urine', 'stool', 'sputum', 'tissue', 'swab', 'other']
  },
  collectionDate: Date,
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processingDate: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date,
  result: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabResult'
  },
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill'
  },
  price: {
    type: Number,
    required: [true, 'Test price is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
labTestSchema.index({ patient: 1, createdAt: -1 });
labTestSchema.index({ status: 1 });
labTestSchema.index({ testType: 1 });

const LabTest = mongoose.model('LabTest', labTestSchema);

module.exports = LabTest;