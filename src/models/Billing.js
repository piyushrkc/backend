// backend/src/models/Billing.js
const mongoose = require('mongoose');

const ServiceItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['consultation', 'procedure', 'medication', 'laboratory', 'radiology', 'other'],
    required: true
  },
  description: {
    type: String
  },
  quantity: {
    type: Number,
    default: 1
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'serviceModel'
  },
  serviceModel: {
    type: String,
    enum: ['Appointment', 'Prescription', 'LabTest', 'Medication'],
    required: function() {
      return this.reference != null;
    }
  }
});

const PaymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'credit-card', 'debit-card', 'insurance', 'online', 'bank-transfer', 'other'],
    required: true
  },
  transactionId: {
    type: String
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  receivedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['successful', 'pending', 'failed', 'refunded'],
    default: 'successful'
  }
});

const BillingSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  services: [ServiceItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  taxTotal: {
    type: Number,
    default: 0
  },
  discountTotal: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    default: 0
  },
  balanceDue: {
    type: Number,
    required: true
  },
  payments: [PaymentSchema],
  status: {
    type: String,
    enum: ['draft', 'issued', 'partially-paid', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  insurance: {
    provider: String,
    policyNumber: String,
    coveragePercentage: Number,
    approvalCode: String,
    claimStatus: {
      type: String,
      enum: ['not-submitted', 'submitted', 'in-process', 'approved', 'partially-approved', 'rejected'],
      default: 'not-submitted'
    }
  }
}, {
  timestamps: true
});

// Pre-save hook to update status based on payments
BillingSchema.pre('save', function(next) {
  // Calculate amountPaid from payments
  this.amountPaid = this.payments.reduce((sum, payment) => {
    if (payment.status === 'successful') {
      return sum + payment.amount;
    }
    return sum;
  }, 0);
  
  // Calculate balance due
  this.balanceDue = this.totalAmount - this.amountPaid;
  
  // Update status based on payments
  if (this.status !== 'cancelled' && this.status !== 'draft') {
    if (this.balanceDue <= 0) {
      this.status = 'paid';
    } else if (this.amountPaid > 0) {
      this.status = 'partially-paid';
    } else if (this.dueDate < new Date() && this.balanceDue > 0) {
      this.status = 'overdue';
    } else {
      this.status = 'issued';
    }
  }
  
  next();
});

// Function to generate invoice number
BillingSchema.statics.generateInvoiceNumber = async function(hospitalId) {
  const today = new Date();
  const year = today.getFullYear().toString().substr(-2);
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const prefix = `INV-${year}${month}-`;
  
  // Find the highest invoice number with this prefix
  const lastInvoice = await this.findOne({ 
    hospital: hospitalId,
    invoiceNumber: new RegExp(`^${prefix}`)
  }).sort({ invoiceNumber: -1 });
  
  let nextNumber = 1;
  if (lastInvoice) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
    nextNumber = lastNumber + 1;
  }
  
  return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
};

// Indexes for efficient querying
BillingSchema.index({ patient: 1 });
BillingSchema.index({ hospital: 1 });
BillingSchema.index({ invoiceNumber: 1 });
BillingSchema.index({ status: 1 });
BillingSchema.index({ issueDate: 1 });
BillingSchema.index({ dueDate: 1 });

const Billing = mongoose.model('Billing', BillingSchema);

module.exports = Billing;