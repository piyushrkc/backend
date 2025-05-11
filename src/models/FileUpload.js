const mongoose = require('mongoose');

const fileUploadSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required']
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required']
  },
  path: {
    type: String,
    required: [true, 'File path is required']
  },
  mimetype: {
    type: String,
    required: [true, 'File MIME type is required']
  },
  size: {
    type: Number,
    required: [true, 'File size is required']
  },
  category: {
    type: String,
    enum: ['profile_picture', 'medical_record', 'lab_result', 'prescription', 'insurance', 'other'],
    default: 'other'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Uploader information is required']
  },
  relatedTo: {
    model: {
      type: String,
      enum: ['Patient', 'Doctor', 'LabTest', 'Prescription']
    },
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedTo.model'
    }
  },
  description: String,
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  accessibleBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
fileUploadSchema.index({ uploadedBy: 1 });
fileUploadSchema.index({ 'relatedTo.model': 1, 'relatedTo.id': 1 });
fileUploadSchema.index({ category: 1 });

// Generate virtual URL
fileUploadSchema.virtual('url').get(function() {
  return `/uploads/${this.path}`;
});

const FileUpload = mongoose.model('FileUpload', fileUploadSchema);

module.exports = FileUpload;