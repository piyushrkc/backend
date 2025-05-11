const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medication name is required'],
    unique: true
  },
  genericName: String,
  category: {
    type: String,
    required: [true, 'Medication category is required']
  },
  manufacturer: String,
  description: String,
  dosageForm: {
    type: String,
    required: [true, 'Dosage form is required'],
    enum: ['tablet', 'capsule', 'liquid', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'spray', 'patch', 'suppository', 'other']
  },
  strength: {
    type: String,
    required: [true, 'Medication strength is required']
  },
  activeIngredient: String,
  contraindications: [String],
  sideEffects: [String],
  interactions: [String],
  storageConditions: String,
  price: {
    type: Number,
    required: [true, 'Price is required']
  },
  taxRate: {
    type: Number,
    default: 0
  },
  barcode: String,
  prescriptionRequired: {
    type: Boolean,
    default: true
  },
  controlled: {
    type: Boolean,
    default: false
  },
  image: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
medicationSchema.index({ name: 1 });
medicationSchema.index({ category: 1 });
medicationSchema.index({ activeIngredient: 1 });

// Virtual populate inventory
medicationSchema.virtual('inventory', {
  ref: 'Inventory',
  foreignField: 'medication',
  localField: '_id'
});

// Calculate total price including tax
medicationSchema.virtual('totalPrice').get(function() {
  return this.price * (1 + this.taxRate / 100);
});

const Medication = mongoose.model('Medication', medicationSchema);

module.exports = Medication;