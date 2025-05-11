const mongoose = require('mongoose');

const medicationReminderSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Reminder must belong to a patient']
  },
  medication: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Medication',
    required: [true, 'Medication is required']
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  name: {
    type: String,
    required: [true, 'Medication name is required']
  },
  dosage: {
    type: String,
    required: [true, 'Dosage is required']
  },
  schedule: [{
    time: {
      type: String, // HH:MM format
      required: [true, 'Schedule time is required']
    },
    days: {
      type: [String],
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'daily'],
      default: ['daily']
    }
  }],
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: Date,
  instructions: String,
  active: {
    type: Boolean,
    default: true
  },
  adherence: {
    taken: [{
      date: {
        type: Date,
        required: true
      },
      time: {
        type: String,
        required: true
      },
      status: {
        type: String,
        enum: ['taken', 'skipped', 'late'],
        required: true
      },
      note: String
    }],
    adherenceRate: {
      type: Number,
      default: 0
    },
    lastUpdated: Date
  },
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    methods: {
      app: {
        type: Boolean,
        default: true
      },
      email: {
        type: Boolean,
        default: false
      },
      sms: {
        type: Boolean,
        default: false
      }
    },
    reminderTime: {
      type: Number, // minutes before scheduled time
      default: 15
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexing for faster queries
medicationReminderSchema.index({ patient: 1, active: 1 });
medicationReminderSchema.index({ active: 1, "schedule.time": 1 });

// Calculate adherence rate before saving
medicationReminderSchema.pre('save', function(next) {
  if (this.adherence.taken && this.adherence.taken.length > 0) {
    const takenCount = this.adherence.taken.filter(record => record.status === 'taken').length;
    const totalCount = this.adherence.taken.length;
    this.adherence.adherenceRate = (takenCount / totalCount) * 100;
    this.adherence.lastUpdated = Date.now();
  }
  next();
});

const MedicationReminder = mongoose.model('MedicationReminder', medicationReminderSchema);

module.exports = MedicationReminder;