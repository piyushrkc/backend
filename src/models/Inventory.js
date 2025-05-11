const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: [true, 'Inventory must reference a medication']
  },
  batchNumber: {
    type: String,
    required: [true, 'Batch number is required']
  },
  expiryDate: {
    type: Date,
    required: [true, 'Expiry date is required']
  },
  initialQuantity: {
    type: Number,
    required: [true, 'Initial quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  currentQuantity: {
    type: Number,
    required: [true, 'Current quantity is required'],
    min: [0, 'Quantity cannot be negative']
  },
  location: {
    shelf: String,
    section: String
  },
  supplier: {
    name: String,
    contactInfo: String,
    orderReference: String
  },
  purchasePrice: {
    type: Number,
    required: [true, 'Purchase price is required']
  },
  purchaseDate: {
    type: Date,
    default: Date.now
  },
  reorderLevel: {
    type: Number,
    default: 10
  },
  transactions: [{
    adjustment: Number, // positive for additions, negative for deductions
    reason: {
      type: String,
      enum: ['purchase', 'dispensing', 'return', 'expired', 'damaged', 'adjustment', 'other']
    },
    notes: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
inventorySchema.index({ medication: 1, batchNumber: 1 }, { unique: true });
inventorySchema.index({ expiryDate: 1 });
inventorySchema.index({ currentQuantity: 1 });

// Virtual for stock status
inventorySchema.virtual('stockStatus').get(function() {
  if (this.currentQuantity === 0) return 'out_of_stock';
  if (this.currentQuantity <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});

// Virtual for expiry status
inventorySchema.virtual('expiryStatus').get(function() {
  const today = new Date();
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  
  if (this.expiryDate < today) return 'expired';
  if (this.expiryDate < oneMonthFromNow) return 'expiring_soon';
  return 'valid';
});

// Middleware to ensure current quantity doesn't exceed initial quantity
inventorySchema.pre('save', function(next) {
  if (this.isNew) {
    this.currentQuantity = this.initialQuantity;
  }
  next();
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;