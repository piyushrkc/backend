// src/controllers/walkInController.js
const Invoice = require('../models/Invoice');
const Hospital = require('../models/Hospital');
const BillingSettings = require('../models/BillingSettings');
const Medication = require('../models/Medication');

/**
 * Controller for handling walk-in customers in pharmacy and laboratory
 */

/**
 * Create a new pharmacy invoice for a walk-in customer
 * @route POST /api/walkin/pharmacy/invoice
 * @access Private (Staff, Pharmacist, Admin)
 */
exports.createPharmacyInvoice = async (req, res) => {
  try {
    const {
      customerName,
      contactNumber,
      email,
      address,
      items,
      paymentMethod,
      paidAmount,
      notes
    } = req.body;

    // Validate required fields
    if (!customerName || !items || !items.length) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and at least one item are required'
      });
    }

    // Get hospital and billing settings
    const hospital = await Hospital.findById(req.user.hospital);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Get billing settings or use defaults
    const billingSettings = await BillingSettings.findOne({ hospital: hospital._id }) || {
      gstNumber: hospital.gstNumber || '',
      gstPercentage: 18,
      invoicePrefix: 'PH'
    };

    // Verify medications exist and get their details
    const medicationIds = items.map(item => item.medicationId);
    const medications = await Medication.find({ _id: { $in: medicationIds } });
    
    if (medications.length !== medicationIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more medications not found'
      });
    }

    // Prepare invoice items with medication details
    const invoiceItems = items.map(item => {
      const medication = medications.find(med => med._id.toString() === item.medicationId);
      
      return {
        description: medication.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice || medication.price,
        amount: (item.unitPrice || medication.price) * item.quantity,
        hsn: medication.hsn || '30049099', // Default HSN code for pharmaceuticals
        gstRate: billingSettings.gstPercentage
      };
    });

    // Calculate totals
    const subtotal = invoiceItems.reduce((total, item) => total + item.amount, 0);
    const gstAmount = (subtotal * billingSettings.gstPercentage) / 100;
    const totalAmount = subtotal + gstAmount;

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber(
      billingSettings.invoicePrefix || 'PH',
      hospital
    );

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: new Date(),
      customerType: 'walk-in',
      walkInCustomer: {
        name: customerName,
        contactNumber,
        email,
        address
      },
      invoiceType: 'pharmacy',
      items: invoiceItems,
      subtotal,
      gstNumber: billingSettings.gstNumber,
      gstPercentage: billingSettings.gstPercentage,
      gstAmount,
      totalAmount,
      paidAmount: paidAmount || 0,
      paymentMethod: paymentMethod || 'Cash',
      notes,
      createdBy: req.user._id,
      hospital: hospital._id
    });

    await invoice.save();

    // Deduct stock (in a real system, you might want this in a transaction)
    for (const item of items) {
      await Medication.findByIdAndUpdate(
        item.medicationId,
        { $inc: { stock: -item.quantity } }
      );
    }

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Pharmacy invoice created successfully'
    });
  } catch (error) {
    console.error('Error creating pharmacy invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating pharmacy invoice',
      error: error.message
    });
  }
};

/**
 * Create a new laboratory invoice for a walk-in customer
 * @route POST /api/walkin/laboratory/invoice
 * @access Private (Staff, Lab Technician, Admin)
 */
exports.createLaboratoryInvoice = async (req, res) => {
  try {
    const {
      customerName,
      contactNumber,
      email,
      address,
      tests,
      paymentMethod,
      paidAmount,
      notes
    } = req.body;

    // Validate required fields
    if (!customerName || !tests || !tests.length) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and at least one test are required'
      });
    }

    // Get hospital and billing settings
    const hospital = await Hospital.findById(req.user.hospital);
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: 'Hospital not found'
      });
    }

    // Get billing settings or use defaults
    const billingSettings = await BillingSettings.findOne({ hospital: hospital._id }) || {
      gstNumber: hospital.gstNumber || '',
      gstPercentage: 18,
      invoicePrefix: 'LAB'
    };

    // Prepare invoice items for lab tests
    const invoiceItems = tests.map(test => {
      return {
        description: test.name,
        quantity: 1,
        unitPrice: test.price,
        amount: test.price,
        hsn: test.hsn || '998931', // Default HSN code for health services
        gstRate: billingSettings.gstPercentage
      };
    });

    // Calculate totals
    const subtotal = invoiceItems.reduce((total, item) => total + item.amount, 0);
    const gstAmount = (subtotal * billingSettings.gstPercentage) / 100;
    const totalAmount = subtotal + gstAmount;

    // Generate invoice number
    const invoiceNumber = await Invoice.generateInvoiceNumber(
      billingSettings.invoicePrefix || 'LAB',
      hospital
    );

    // Create invoice
    const invoice = new Invoice({
      invoiceNumber,
      invoiceDate: new Date(),
      dueDate: new Date(),
      customerType: 'walk-in',
      walkInCustomer: {
        name: customerName,
        contactNumber,
        email,
        address
      },
      invoiceType: 'laboratory',
      items: invoiceItems,
      subtotal,
      gstNumber: billingSettings.gstNumber,
      gstPercentage: billingSettings.gstPercentage,
      gstAmount,
      totalAmount,
      paidAmount: paidAmount || 0,
      paymentMethod: paymentMethod || 'Cash',
      notes,
      createdBy: req.user._id,
      hospital: hospital._id
    });

    await invoice.save();

    res.status(201).json({
      success: true,
      data: invoice,
      message: 'Laboratory invoice created successfully'
    });
  } catch (error) {
    console.error('Error creating laboratory invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating laboratory invoice',
      error: error.message
    });
  }
};

/**
 * Get all walk-in invoices for a hospital
 * @route GET /api/walkin/invoices
 * @access Private (Staff, Admin)
 */
exports.getWalkInInvoices = async (req, res) => {
  try {
    const { type, searchTerm, startDate, endDate, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {
      hospital: req.user.hospital,
      customerType: 'walk-in'
    };
    
    // Filter by invoice type
    if (type && ['pharmacy', 'laboratory'].includes(type)) {
      query.invoiceType = type;
    }
    
    // Filter by date range
    if (startDate && endDate) {
      query.invoiceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Search by customer name
    if (searchTerm) {
      query['walkInCustomer.name'] = { $regex: searchTerm, $options: 'i' };
    }
    
    // Count total documents
    const total = await Invoice.countDocuments(query);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get invoices
    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching walk-in invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching walk-in invoices',
      error: error.message
    });
  }
};

/**
 * Get a walk-in invoice by ID
 * @route GET /api/walkin/invoices/:id
 * @access Private (Staff, Admin)
 */
exports.getWalkInInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      hospital: req.user.hospital,
      customerType: 'walk-in'
    });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching walk-in invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching walk-in invoice',
      error: error.message
    });
  }
};