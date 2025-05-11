// src/models/Invoice.js
const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Item description is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  hsn: {
    type: String,
    trim: true
  },
  gstRate: {
    type: Number,
    default: 0
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    required: [true, 'Invoice date is required'],
    default: Date.now
  },
  dueDate: {
    type: Date
  },
  // Support both registered patients and walk-in customers
  customerType: {
    type: String,
    enum: ['registered', 'walk-in'],
    default: 'registered'
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: function() { return this.customerType === 'registered'; }
  },
  walkInCustomer: {
    name: {
      type: String,
      required: function() { return this.customerType === 'walk-in'; }
    },
    contactNumber: String,
    email: String,
    address: String
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  labTest: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LabTest'
  },
  invoiceType: {
    type: String,
    enum: ['consultation', 'laboratory', 'pharmacy'],
    required: [true, 'Invoice type is required']
  },
  items: [invoiceItemSchema],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  gstNumber: {
    type: String,
    trim: true
  },
  gstPercentage: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  balanceDue: {
    type: Number,
    default: function() {
      return this.totalAmount - this.paidAmount;
    }
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Insurance', 'Other'],
    default: 'Cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'unpaid'],
    default: 'unpaid'
  },
  notes: {
    type: String,
    trim: true
  },
  paymentDate: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by is required']
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: [true, 'Hospital is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for faster queries
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ patient: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ hospital: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ invoiceType: 1 });
invoiceSchema.index({ hospital: 1, invoiceDate: -1 });
invoiceSchema.index({ hospital: 1, paymentStatus: 1 });
invoiceSchema.index({ customerType: 1 });
invoiceSchema.index({ 'walkInCustomer.name': 1 });
invoiceSchema.index({ 'walkInCustomer.contactNumber': 1 });

// Pre-save hook to calculate balanceDue and paymentStatus
invoiceSchema.pre('save', function(next) {
  // Calculate balanceDue
  this.balanceDue = this.totalAmount - this.paidAmount;
  
  // Set paymentStatus based on paid amount
  if (this.paidAmount <= 0) {
    this.paymentStatus = 'unpaid';
  } else if (this.paidAmount < this.totalAmount) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'paid';
    this.paymentDate = this.paymentDate || new Date();
  }
  
  next();
});

// Static method to generate a new invoice number
invoiceSchema.statics.generateInvoiceNumber = async function(prefix = 'INV', hospital) {
  // Get the count of invoices for this hospital
  const count = await this.countDocuments({ hospital: hospital._id });
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  // Generate invoice number: PREFIX-YY-MM-XXXX
  return `${prefix}-${currentYear}${currentMonth}-${(count + 1).toString().padStart(4, '0')}`;
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;