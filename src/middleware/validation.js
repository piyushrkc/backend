// src/middleware/validation.js

const { body, param, query, validationResult } = require('express-validator');

/**
 * A collection of validation middlewares for different routes
 */
const validators = {
  // User validation rules
  user: {
    create: [
      body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
      body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
      body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
      body('password')
        .trim()
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      body('phoneNumber')
        .optional()
        .isMobilePhone().withMessage('Please provide a valid phone number'),
      body('role')
        .trim()
        .notEmpty().withMessage('Role is required')
        .isIn(['admin', 'doctor', 'patient', 'nurse', 'receptionist', 'pharmacist', 'lab_technician'])
        .withMessage('Invalid role specified'),
      body('hospital')
        .trim()
        .notEmpty().withMessage('Hospital ID is required')
        .isMongoId().withMessage('Invalid hospital ID format')
    ],
    update: [
      body('firstName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
      body('lastName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
      body('phoneNumber')
        .optional()
        .isMobilePhone().withMessage('Please provide a valid phone number'),
      body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean value')
    ]
  },
  
  // Patient validation rules
  patient: {
    create: [
      body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 2, max: 50 }).withMessage('First name must be between 2 and 50 characters'),
      body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be between 2 and 50 characters'),
      body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
      body('password')
        .trim()
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
      body('phoneNumber')
        .optional()
        .isMobilePhone().withMessage('Please provide a valid phone number'),
      body('dateOfBirth')
        .notEmpty().withMessage('Date of birth is required')
        .isISO8601().withMessage('Date of birth must be a valid date')
        .toDate(),
      body('gender')
        .notEmpty().withMessage('Gender is required')
        .isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
      body('address.street')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Street address cannot exceed 100 characters'),
      body('address.city')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('City cannot exceed 50 characters'),
      body('address.state')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('State cannot exceed 50 characters'),
      body('address.zipCode')
        .optional()
        .trim()
        .isLength({ max: 20 }).withMessage('Zip code cannot exceed 20 characters'),
      body('address.country')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Country cannot exceed 50 characters'),
      body('emergencyContact.name')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Emergency contact name cannot exceed 100 characters'),
      body('emergencyContact.relationship')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Relationship cannot exceed 50 characters'),
      body('emergencyContact.phoneNumber')
        .optional()
        .isMobilePhone().withMessage('Please provide a valid emergency contact phone number'),
      body('allergies')
        .optional()
        .isArray().withMessage('Allergies must be an array'),
      body('allergies.*')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Each allergy must be between 1 and 100 characters'),
      body('medicalHistory')
        .optional()
        .isArray().withMessage('Medical history must be an array'),
      body('medicalHistory.*.condition')
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Condition must be between 1 and 100 characters'),
      body('medicalHistory.*.diagnosedDate')
        .optional()
        .isISO8601().withMessage('Diagnosed date must be a valid date')
        .toDate()
    ],
    update: [
      body('phoneNumber')
        .optional()
        .isMobilePhone().withMessage('Please provide a valid phone number'),
      body('address')
        .optional()
        .isObject().withMessage('Address must be an object'),
      body('emergencyContact')
        .optional()
        .isObject().withMessage('Emergency contact must be an object'),
      body('allergies')
        .optional()
        .isArray().withMessage('Allergies must be an array'),
      body('medicalHistory')
        .optional()
        .isArray().withMessage('Medical history must be an array')
    ]
  },
  
  // Appointment validation rules
  appointment: {
    create: [
      body('patientId')
        .optional()
        .isMongoId().withMessage('Invalid patient ID format'),
      body('doctorId')
        .notEmpty().withMessage('Doctor ID is required')
        .isMongoId().withMessage('Invalid doctor ID format'),
      body('appointmentDate')
        .notEmpty().withMessage('Appointment date is required')
        .isISO8601().withMessage('Appointment date must be a valid date')
        .toDate()
        .custom(value => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (value < today) {
            throw new Error('Appointment date cannot be in the past');
          }
          return true;
        }),
      body('startTime')
        .notEmpty().withMessage('Start time is required')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
      body('endTime')
        .notEmpty().withMessage('End time is required')
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format')
        .custom((value, { req }) => {
          if (req.body.startTime && value <= req.body.startTime) {
            throw new Error('End time must be after start time');
          }
          return true;
        }),
      body('reason')
        .notEmpty().withMessage('Reason is required')
        .trim()
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3 and 200 characters'),
      body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters'),
      body('priority')
        .optional()
        .isIn(['low', 'normal', 'high', 'urgent']).withMessage('Priority must be low, normal, high, or urgent'),
      body('isFollowUp')
        .optional()
        .isBoolean().withMessage('isFollowUp must be a boolean value')
    ],
    update: [
      body('appointmentDate')
        .optional()
        .isISO8601().withMessage('Appointment date must be a valid date')
        .toDate()
        .custom(value => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (value < today) {
            throw new Error('Appointment date cannot be in the past');
          }
          return true;
        }),
      body('status')
        .optional()
        .isIn(['scheduled', 'confirmed', 'completed', 'canceled', 'no-show'])
        .withMessage('Invalid status provided'),
      body('startTime')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Start time must be in HH:MM format'),
      body('endTime')
        .optional()
        .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('End time must be in HH:MM format'),
      body('reason')
        .optional()
        .trim()
        .isLength({ min: 3, max: 200 }).withMessage('Reason must be between 3 and 200 characters'),
      body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    ],
    cancel: [
      body('cancellationReason')
        .notEmpty().withMessage('Cancellation reason is required')
        .trim()
        .isLength({ min: 3, max: 200 }).withMessage('Cancellation reason must be between 3 and 200 characters')
    ]
  },
  
  // Medication validation rules
  medication: {
    create: [
      body('name')
        .notEmpty().withMessage('Medication name is required')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Medication name must be between 2 and 100 characters'),
      body('genericName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Generic name cannot exceed 100 characters'),
      body('category')
        .notEmpty().withMessage('Category is required')
        .trim()
        .isLength({ min: 2, max: 50 }).withMessage('Category must be between 2 and 50 characters'),
      body('form')
        .notEmpty().withMessage('Medication form is required')
        .isIn(['tablet', 'capsule', 'liquid', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'spray', 'patch', 'suppository', 'other'])
        .withMessage('Invalid medication form provided'),
      body('strength')
        .notEmpty().withMessage('Strength is required')
        .trim()
        .isLength({ min: 1, max: 50 }).withMessage('Strength must be between 1 and 50 characters'),
      body('manufacturer')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Manufacturer cannot exceed 100 characters'),
      body('description')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),
      body('sideEffects')
        .optional()
        .isArray().withMessage('Side effects must be an array'),
      body('contraindications')
        .optional()
        .isArray().withMessage('Contraindications must be an array'),
      body('dosageInstructions')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Dosage instructions cannot exceed 500 characters'),
      body('inventory.currentStock')
        .optional()
        .isInt({ min: 0 }).withMessage('Current stock must be a non-negative integer'),
      body('inventory.batchNumber')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Batch number cannot exceed 50 characters'),
      body('inventory.expiryDate')
        .optional()
        .isISO8601().withMessage('Expiry date must be a valid date')
        .toDate(),
      body('pricing')
        .optional()
        .isObject().withMessage('Pricing must be an object'),
      body('pricing.costPrice')
        .optional()
        .isFloat({ min: 0 }).withMessage('Cost price must be a non-negative number'),
      body('pricing.sellingPrice')
        .optional()
        .isFloat({ min: 0 }).withMessage('Selling price must be a non-negative number'),
      body('needsPrescription')
        .optional()
        .isBoolean().withMessage('needsPrescription must be a boolean value')
    ],
    updateInventory: [
      body('quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt().withMessage('Quantity must be an integer'),
      body('action')
        .notEmpty().withMessage('Action is required')
        .isIn(['add', 'remove']).withMessage('Action must be either "add" or "remove"'),
      body('batchNumber')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Batch number cannot exceed 50 characters'),
      body('expiryDate')
        .optional()
        .isISO8601().withMessage('Expiry date must be a valid date')
        .toDate()
    ]
  },
  
  // Prescription validation rules
  prescription: {
    create: [
      body('patient')
        .notEmpty().withMessage('Patient ID is required')
        .isMongoId().withMessage('Invalid patient ID format'),
      body('doctor')
        .notEmpty().withMessage('Doctor ID is required')
        .isMongoId().withMessage('Invalid doctor ID format'),
      body('diagnosis')
        .notEmpty().withMessage('Diagnosis is required')
        .trim()
        .isLength({ min: 2, max: 200 }).withMessage('Diagnosis must be between 2 and 200 characters'),
      body('medications')
        .notEmpty().withMessage('Medications are required')
        .isArray().withMessage('Medications must be an array')
        .custom(value => {
          if (value.length === 0) {
            throw new Error('At least one medication is required');
          }
          return true;
        }),
      body('medications.*.medication')
        .notEmpty().withMessage('Medication ID is required')
        .isMongoId().withMessage('Invalid medication ID format'),
      body('medications.*.dosage')
        .notEmpty().withMessage('Dosage is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Dosage must be between 1 and 100 characters'),
      body('medications.*.frequency')
        .notEmpty().withMessage('Frequency is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Frequency must be between 1 and 100 characters'),
      body('medications.*.duration')
        .notEmpty().withMessage('Duration is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Duration must be between 1 and 100 characters'),
      body('medications.*.quantity')
        .notEmpty().withMessage('Quantity is required')
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
      body('instructions')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Instructions cannot exceed 500 characters'),
      body('refillable')
        .optional()
        .isBoolean().withMessage('Refillable must be a boolean value'),
      body('refillsAllowed')
        .optional()
        .isInt({ min: 0 }).withMessage('Refills allowed must be a non-negative integer')
    ],
    updateStatus: [
      body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['pending', 'filled', 'completed', 'denied']).withMessage('Invalid status provided'),
      body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    ]
  },
  
  // Lab test validation rules
  labTest: {
    create: [
      body('patient')
        .notEmpty().withMessage('Patient ID is required')
        .isMongoId().withMessage('Invalid patient ID format'),
      body('testType')
        .notEmpty().withMessage('Test type is required')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Test type must be between 2 and 100 characters'),
      body('orderedBy')
        .notEmpty().withMessage('Doctor ID is required')
        .isMongoId().withMessage('Invalid doctor ID format'),
      body('priority')
        .optional()
        .isIn(['routine', 'urgent', 'stat']).withMessage('Priority must be routine, urgent, or stat'),
      body('requiredFasting')
        .optional()
        .isBoolean().withMessage('requiredFasting must be a boolean value'),
      body('sampleType')
        .optional()
        .isIn(['blood', 'urine', 'stool', 'sputum', 'tissue', 'swab', 'other']).withMessage('Invalid sample type provided'),
      body('instructions')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Instructions cannot exceed 500 characters'),
      body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0 }).withMessage('Price must be a non-negative number')
    ],
    updateStatus: [
      body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['ordered', 'collected', 'processing', 'completed', 'cancelled']).withMessage('Invalid status provided')
    ],
    createResult: [
      body('labTest')
        .notEmpty().withMessage('Lab test ID is required')
        .isMongoId().withMessage('Invalid lab test ID format'),
      body('results')
        .notEmpty().withMessage('Results are required')
        .isArray().withMessage('Results must be an array')
        .custom(value => {
          if (value.length === 0) {
            throw new Error('At least one result parameter is required');
          }
          return true;
        }),
      body('results.*.parameter')
        .notEmpty().withMessage('Parameter name is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Parameter name must be between 1 and 100 characters'),
      body('results.*.value')
        .notEmpty().withMessage('Result value is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Result value must be between 1 and 100 characters'),
      body('results.*.unit')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Unit cannot exceed 50 characters'),
      body('results.*.referenceRange')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Reference range cannot exceed 100 characters'),
      body('results.*.interpretation')
        .optional()
        .isIn(['normal', 'low', 'high', 'abnormal', 'critical']).withMessage('Invalid interpretation provided'),
      body('summary')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Summary cannot exceed 500 characters'),
      body('interpretation')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Interpretation cannot exceed 500 characters'),
      body('recommendations')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Recommendations cannot exceed 500 characters')
    ]
  },
  
  // Billing validation rules
  billing: {
    create: [
      body('patient')
        .notEmpty().withMessage('Patient ID is required')
        .isMongoId().withMessage('Invalid patient ID format'),
      body('items')
        .notEmpty().withMessage('Bill items are required')
        .isArray().withMessage('Items must be an array')
        .custom(value => {
          if (value.length === 0) {
            throw new Error('At least one bill item is required');
          }
          return true;
        }),
      body('items.*.description')
        .notEmpty().withMessage('Item description is required')
        .trim()
        .isLength({ min: 1, max: 200 }).withMessage('Description must be between 1 and 200 characters'),
      body('items.*.type')
        .notEmpty().withMessage('Item type is required')
        .isIn(['consultation', 'medication', 'lab_test', 'procedure', 'other']).withMessage('Invalid item type provided'),
      body('items.*.quantity')
        .optional()
        .isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
      body('items.*.unitPrice')
        .notEmpty().withMessage('Unit price is required')
        .isFloat({ min: 0 }).withMessage('Unit price must be a non-negative number'),
      body('items.*.amount')
        .notEmpty().withMessage('Amount is required')
        .isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
      body('subtotal')
        .notEmpty().withMessage('Subtotal is required')
        .isFloat({ min: 0 }).withMessage('Subtotal must be a non-negative number'),
      body('taxTotal')
        .optional()
        .isFloat({ min: 0 }).withMessage('Tax total must be a non-negative number'),
      body('discount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),
      body('totalAmount')
        .notEmpty().withMessage('Total amount is required')
        .isFloat({ min: 0 }).withMessage('Total amount must be a non-negative number'),
      body('status')
        .optional()
        .isIn(['pending', 'partial', 'paid', 'cancelled']).withMessage('Invalid status provided'),
      body('paymentDue')
        .optional()
        .isISO8601().withMessage('Payment due date must be a valid date')
        .toDate()
    ],
    recordPayment: [
      body('amount')
        .notEmpty().withMessage('Payment amount is required')
        .isFloat({ min: 0.01 }).withMessage('Payment amount must be greater than 0'),
      body('paymentMethod')
        .notEmpty().withMessage('Payment method is required')
        .isIn(['cash', 'credit_card', 'debit_card', 'insurance', 'bank_transfer', 'check', 'mobile_payment', 'other'])
        .withMessage('Invalid payment method provided'),
      body('transactionId')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Transaction ID cannot exceed 100 characters'),
      body('notes')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Notes cannot exceed 500 characters')
    ]
  },
  
  // Notification validation rules
  notification: {
    create: [
      body('recipient')
        .notEmpty().withMessage('Recipient ID is required')
        .isMongoId().withMessage('Invalid recipient ID format'),
      body('title')
        .notEmpty().withMessage('Title is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
      body('content')
        .notEmpty().withMessage('Content is required')
        .trim()
        .isLength({ min: 1, max: 500 }).withMessage('Content must be between 1 and 500 characters'),
      body('type')
        .optional()
        .isIn(['appointment', 'prescription', 'lab_result', 'payment', 'medication_reminder', 'system', 'other'])
        .withMessage('Invalid notification type provided'),
      body('priority')
        .optional()
        .isIn(['low', 'normal', 'high', 'urgent']).withMessage('Priority must be low, normal, high, or urgent')
    ],
    bulkSend: [
      body('title')
        .notEmpty().withMessage('Title is required')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Title must be between 1 and 100 characters'),
      body('content')
        .notEmpty().withMessage('Content is required')
        .trim()
        .isLength({ min: 1, max: 500 }).withMessage('Content must be between 1 and 500 characters'),
      body('recipients')
        .notEmpty().withMessage('Recipients are required')
        .isArray().withMessage('Recipients must be an array')
        .custom(value => {
          if (value.length === 0) {
            throw new Error('At least one recipient is required');
          }
          return true;
        }),
      body('recipients.*')
        .isMongoId().withMessage('Each recipient must be a valid ID'),
      body('type')
        .optional()
        .isIn(['appointment', 'prescription', 'lab_result', 'payment', 'medication_reminder', 'system', 'other'])
        .withMessage('Invalid notification type provided'),
      body('channel')
        .optional()
        .isIn(['email', 'sms', 'both']).withMessage('Channel must be email, sms, or both')
    ]
  }
};

/**
 * Validates request and returns errors if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * Helper to chain validation middlewares
 * @param {Array} validations - Array of validation middlewares
 * @returns {Array} - Array of middlewares including the final validator
 */
const validateRequest = (validations) => {
  return [...validations, validate];
};

module.exports = {
  validators,
  validate,
  validateRequest
};