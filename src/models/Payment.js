const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  bill: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bill',
    required: [true, 'Payment must be associated with a bill']
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Payment must be associated with a patient']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0.01, 'Payment amount must be greater than 0']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit_card', 'debit_card', 'insurance', 'bank_transfer', 'check', 'mobile_payment', 'other'],
    required: [true, 'Payment method is required']
  },
  transactionId: String,
  receiptNumber: {
    type: String,
    unique: true
  },
  notes: String,
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'failed', 'refunded'],
    default: 'completed'
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Received by is required']
  },
  refundDetails: {
    amount: Number,
    reason: String,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: Date
  },
  cardDetails: {
    lastFourDigits: String,
    cardType: String,
    approvalCode: String
  },
  insuranceClaim: {
    claimNumber: String,
    approvalCode: String,
    approvedAmount: Number,
    rejectionReason: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
paymentSchema.index({ bill: 1 });
paymentSchema.index({ patient: 1 });
paymentSchema.index({ paymentDate: 1 });
paymentSchema.index({ status: 1 });

// Generate receipt number before saving
paymentSchema.pre('save', function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.receiptNumber = `RCPT-${year}${month}${day}-${random}`;
  }
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;