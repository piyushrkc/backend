const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Bill must belong to a patient']
  },
  billNumber: {
    type: String,
    unique: true
  },
  billDate: {
    type: Date,
    default: Date.now
  },
  items: [{
    description: {
      type: String,
      required: [true, 'Item description is required']
    },
    type: {
      type: String,
      enum: ['consultation', 'medication', 'lab_test', 'procedure', 'other'],
      required: [true, 'Item type is required']
    },
    quantity: {
      type: Number,
      default: 1
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required']
    },
    taxRate: {
      type: Number,
      default: 0
    },
    taxAmount: Number,
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'items.referenceModel'
    },
    referenceModel: {
      type: String,
      enum: ['Appointment', 'Prescription', 'LabTest', 'Procedure']
    }
  }],
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  labTests: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest'
  }],
  prescriptions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required']
  },
  taxTotal: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required']
  },
  discountedAmount: Number,
  remainingAmount: Number,
  status: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'cancelled'],
    default: 'pending'
  },
  paymentDue: Date,
  notes: String,
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  insurance: {
    provider: String,
    policyNumber: String,
    claimNumber: String,
    covered: {
      type: Boolean,
      default: false
    },
    coveredAmount: {
      type: Number,
      default: 0
    },
    copay: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
billSchema.index({ patient: 1, createdAt: -1 });
billSchema.index({ billNumber: 1 });
billSchema.index({ status: 1 });

// Generate bill number before saving
billSchema.pre('save', function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.billNumber = `BILL-${year}${month}-${random}`;
    
    // Set payment due date to 30 days from bill date by default if not specified
    if (!this.paymentDue) {
      const dueDate = new Date(this.billDate);
      dueDate.setDate(dueDate.getDate() + 30);
      this.paymentDue = dueDate;
    }
    
    // Calculate discounted amount
    this.discountedAmount = this.totalAmount - this.discount;
    
    // Set remaining amount to discounted amount initially
    this.remainingAmount = this.discountedAmount;
  }
  next();
});

// Calculate totals before save
billSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isNew) {
    // Calculate subtotal and tax total
    this.subtotal = 0;
    this.taxTotal = 0;
    
    this.items.forEach(item => {
      // Calculate amount if not provided
      if (!item.amount) {
        item.amount = item.quantity * item.unitPrice;
      }
      
      // Calculate tax amount
      item.taxAmount = item.amount * (item.taxRate / 100);
      
      this.subtotal += item.amount;
      this.taxTotal += item.taxAmount;
    });
    
    // Calculate total amount
    this.totalAmount = this.subtotal + this.taxTotal;
    
    // Recalculate discounted amount
    this.discountedAmount = this.totalAmount - this.discount;
    
    // Update remaining amount
    if (!this.payments || this.payments.length === 0) {
      this.remainingAmount = this.discountedAmount;
    }
  }
  next();
});

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;