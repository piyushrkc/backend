const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Bill = require('../models/Bill.js');
const Payment = require('../models/Payment');
const LabTest = require('../models/LabTest');
const Prescription = require('../models/Prescription');
const Inventory = require('../models/Inventory');
const Medication = require('../models/Medication');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Daily appointments report
exports.getDailyAppointmentsReport = catchAsync(async (req, res, next) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  
  // Set time to beginning of day
  targetDate.setHours(0, 0, 0, 0);
  
  // Set time to end of day for comparison
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const appointments = await Appointment.find({
    appointmentDate: {
      $gte: targetDate,
      $lt: nextDay
    }
  })
    .populate('patient', 'name contactNumber')
    .populate('doctor', 'name specialization')
    .sort('appointmentTime');
  
  // Group by status
  const scheduled = appointments.filter(app => app.status === 'scheduled');
  const completed = appointments.filter(app => app.status === 'completed');
  const cancelled = appointments.filter(app => app.status === 'cancelled');
  const noShow = appointments.filter(app => app.status === 'no-show');
  
  // Group by doctor
  const byDoctor = {};
  appointments.forEach(app => {
    if (app.doctor) {
      const doctorId = app.doctor._id.toString();
      if (!byDoctor[doctorId]) {
        byDoctor[doctorId] = {
          doctor: {
            id: doctorId,
            name: app.doctor.name,
            specialization: app.doctor.specialization
          },
          appointments: []
        };
      }
      byDoctor[doctorId].appointments.push(app);
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      date: targetDate,
      total: appointments.length,
      scheduled: scheduled.length,
      completed: completed.length,
      cancelled: cancelled.length,
      noShow: noShow.length,
      byStatus: {
        scheduled,
        completed,
        cancelled,
        noShow
      },
      byDoctor
    }
  });
});

// Monthly appointments report
exports.getMonthlyAppointmentsReport = catchAsync(async (req, res, next) => {
  const { month, year } = req.query;
  
  // Default to current month and year
  const currentDate = new Date();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();
  
  // Start of month
  const startDate = new Date(targetYear, targetMonth, 1);
  
  // End of month
  const endDate = new Date(targetYear, targetMonth + 1, 0);
  endDate.setHours(23, 59, 59, 999);
  
  const appointments = await Appointment.find({
    appointmentDate: {
      $gte: startDate,
      $lte: endDate
    }
  })
    .populate('patient', 'name')
    .populate('doctor', 'name specialization');
  
  // Group by day
  const byDay = {};
  appointments.forEach(app => {
    const day = app.appointmentDate.getDate();
    if (!byDay[day]) {
      byDay[day] = [];
    }
    byDay[day].push(app);
  });
  
  // Group by status
  const byStatus = {
    scheduled: appointments.filter(app => app.status === 'scheduled').length,
    completed: appointments.filter(app => app.status === 'completed').length,
    cancelled: appointments.filter(app => app.status === 'cancelled').length,
    noShow: appointments.filter(app => app.status === 'no-show').length
  };
  
  // Group by doctor
  const byDoctor = {};
  appointments.forEach(app => {
    if (app.doctor) {
      const doctorId = app.doctor._id.toString();
      if (!byDoctor[doctorId]) {
        byDoctor[doctorId] = {
          doctor: {
            id: doctorId,
            name: app.doctor.name,
            specialization: app.doctor.specialization
          },
          count: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0
        };
      }
      byDoctor[doctorId].count++;
      if (app.status === 'completed') byDoctor[doctorId].completed++;
      if (app.status === 'cancelled') byDoctor[doctorId].cancelled++;
      if (app.status === 'no-show') byDoctor[doctorId].noShow++;
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      month: targetMonth + 1,
      year: targetYear,
      total: appointments.length,
      byStatus,
      byDay,
      byDoctor
    }
  });
});

// Revenue report
exports.getRevenueReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, groupBy } = req.query;
  
  // Default to current month if no dates provided
  const currentDate = new Date();
  const defaultStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const defaultEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const start = startDate ? new Date(startDate) : defaultStartDate;
  const end = endDate ? new Date(endDate) : defaultEndDate;
  
  // Validate dates
  if (start > end) {
    return next(new AppError('Start date cannot be after end date', 400));
  }
  
  // Get payments within date range
  const payments = await Payment.find({
    createdAt: {
      $gte: start,
      $lte: end
    }
  })
    .populate({
      path: 'bill',
      populate: {
        path: 'patient',
        select: 'name'
      }
    })
    .sort('createdAt');
  
  // Calculate total revenue
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Group by payment method
  const byPaymentMethod = {};
  payments.forEach(payment => {
    const method = payment.paymentMethod;
    if (!byPaymentMethod[method]) {
      byPaymentMethod[method] = {
        count: 0,
        amount: 0
      };
    }
    byPaymentMethod[method].count++;
    byPaymentMethod[method].amount += payment.amount;
  });
  
  // Group data based on requested grouping
  let groupedData = {};
  
  if (groupBy === 'day') {
    payments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!groupedData[date]) {
        groupedData[date] = {
          count: 0,
          amount: 0
        };
      }
      groupedData[date].count++;
      groupedData[date].amount += payment.amount;
    });
  } else if (groupBy === 'week') {
    payments.forEach(payment => {
      const paymentDate = new Date(payment.createdAt);
      const firstDayOfYear = new Date(paymentDate.getFullYear(), 0, 1);
      const pastDaysOfYear = (paymentDate - firstDayOfYear) / 86400000;
      const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      
      const key = `${paymentDate.getFullYear()}-W${weekNumber}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          count: 0,
          amount: 0
        };
      }
      groupedData[key].count++;
      groupedData[key].amount += payment.amount;
    });
  } else if (groupBy === 'month') {
    payments.forEach(payment => {
      const date = payment.createdAt;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          count: 0,
          amount: 0
        };
      }
      groupedData[key].count++;
      groupedData[key].amount += payment.amount;
    });
  } else {
    // Default to daily grouping
    payments.forEach(payment => {
      const date = payment.createdAt.toISOString().split('T')[0];
      if (!groupedData[date]) {
        groupedData[date] = {
          count: 0,
          amount: 0
        };
      }
      groupedData[date].count++;
      groupedData[date].amount += payment.amount;
    });
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      startDate: start,
      endDate: end,
      totalRevenue,
      paymentsCount: payments.length,
      byPaymentMethod,
      groupedData
    }
  });
});

// Patient demographics report
exports.getPatientDemographicsReport = catchAsync(async (req, res, next) => {
  // Get all patients
  const patients = await Patient.find().select('gender dateOfBirth address');
  
  // Age groups
  const ageGroups = {
    'Under 18': 0,
    '18-30': 0,
    '31-45': 0,
    '46-60': 0,
    'Over 60': 0,
    'Unknown': 0
  };
  
  // Gender distribution
  const genderDistribution = {
    'Male': 0,
    'Female': 0,
    'Other': 0,
    'Unknown': 0
  };
  
  // Location distribution (by city)
  const locationDistribution = {};
  
  // Process each patient
  patients.forEach(patient => {
    // Calculate age
    if (patient.dateOfBirth) {
      const today = new Date();
      const birthDate = new Date(patient.dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      // Classify into age group
      if (age < 18) ageGroups['Under 18']++;
      else if (age >= 18 && age <= 30) ageGroups['18-30']++;
      else if (age >= 31 && age <= 45) ageGroups['31-45']++;
      else if (age >= 46 && age <= 60) ageGroups['46-60']++;
      else ageGroups['Over 60']++;
    } else {
      ageGroups['Unknown']++;
    }
    
    // Classify by gender
    if (patient.gender) {
      if (patient.gender.toLowerCase() === 'male') genderDistribution['Male']++;
      else if (patient.gender.toLowerCase() === 'female') genderDistribution['Female']++;
      else genderDistribution['Other']++;
    } else {
      genderDistribution['Unknown']++;
    }
    
    // Classify by location
    if (patient.address && patient.address.city) {
      const city = patient.address.city;
      if (!locationDistribution[city]) {
        locationDistribution[city] = 0;
      }
      locationDistribution[city]++;
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      totalPatients: patients.length,
      ageGroups,
      genderDistribution,
      locationDistribution
    }
  });
});

// Doctor performance report
exports.getDoctorPerformanceReport = catchAsync(async (req, res, next) => {
  const { doctorId, startDate, endDate } = req.query;
  
  // Default to last 30 days if no dates provided
  const currentDate = new Date();
  const defaultStartDate = new Date(currentDate);
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const start = startDate ? new Date(startDate) : defaultStartDate;
  const end = endDate ? new Date(endDate) : currentDate;
  
  // Filter for a specific doctor if provided
  const doctorFilter = doctorId ? { doctor: doctorId } : {};
  
  // Get appointments in date range
  const appointments = await Appointment.find({
    ...doctorFilter,
    appointmentDate: {
      $gte: start,
      $lte: end
    }
  })
    .populate('doctor', 'name specialization')
    .populate('patient', 'name');
  
  // Group by doctor
  const byDoctor = {};
  
  appointments.forEach(app => {
    if (app.doctor) {
      const id = app.doctor._id.toString();
      
      if (!byDoctor[id]) {
        byDoctor[id] = {
          doctor: {
            id,
            name: app.doctor.name,
            specialization: app.doctor.specialization
          },
          totalAppointments: 0,
          completed: 0,
          cancelled: 0,
          noShow: 0,
          averageDuration: 0,
          totalDuration: 0,
          patients: new Set()
        };
      }
      
      byDoctor[id].totalAppointments++;
      
      if (app.status === 'completed') {
        byDoctor[id].completed++;
        
        // Calculate duration if available
        if (app.startTime && app.endTime) {
          const duration = (new Date(app.endTime) - new Date(app.startTime)) / (1000 * 60); // in minutes
          byDoctor[id].totalDuration += duration;
        }
      }
      
      if (app.status === 'cancelled') byDoctor[id].cancelled++;
      if (app.status === 'no-show') byDoctor[id].noShow++;
      
      // Add patient to set
      if (app.patient) {
        byDoctor[id].patients.add(app.patient._id.toString());
      }
    }
  });
  
  // Calculate averages and convert Sets to counts
  Object.values(byDoctor).forEach(doctor => {
    if (doctor.completed > 0) {
      doctor.averageDuration = doctor.totalDuration / doctor.completed;
    }
    doctor.uniquePatients = doctor.patients.size;
    delete doctor.patients;
    delete doctor.totalDuration;
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      startDate: start,
      endDate: end,
      doctors: Object.values(byDoctor)
    }
  });
});

// Inventory status report
exports.getInventoryStatusReport = catchAsync(async (req, res, next) => {
  const { category } = req.query;
  
  // Filter by category if provided
  const filter = {};
  if (category) {
    // First get medications in this category
    const medications = await Medication.find({ category }).select('_id');
    const medicationIds = medications.map(med => med._id);
    
    filter.medication = { $in: medicationIds };
  }
  
  // Get inventory items
  const inventory = await Inventory.find(filter)
    .populate('medication', 'name category dosageForm strength price');
  
  // Calculate stats
  const totalItems = inventory.length;
  let totalStock = 0;
  let totalValue = 0;
  const lowStock = [];
  const expired = [];
  const expiringInMonth = [];
  
  // Current date
  const now = new Date();
  const oneMonthLater = new Date(now);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  
  // Organize by category
  const byCategory = {};
  
  inventory.forEach(item => {
    if (item.medication) {
      // Add to total stock and value
      totalStock += item.currentQuantity;
      totalValue += item.currentQuantity * (item.medication.price || 0);
      
      // Check if low stock
      if (item.currentQuantity < 10) {
        lowStock.push(item);
      }
      
      // Check if expired
      if (item.expiryDate < now) {
        expired.push(item);
      }
      
      // Check if expiring in a month
      if (item.expiryDate > now && item.expiryDate < oneMonthLater) {
        expiringInMonth.push(item);
      }
      
      // Group by category
      const category = item.medication.category || 'Uncategorized';
      if (!byCategory[category]) {
        byCategory[category] = {
          count: 0,
          stock: 0,
          value: 0
        };
      }
      
      byCategory[category].count++;
      byCategory[category].stock += item.currentQuantity;
      byCategory[category].value += item.currentQuantity * (item.medication.price || 0);
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      totalItems,
      totalStock,
      totalValue,
      lowStockCount: lowStock.length,
      expiredCount: expired.length,
      expiringCount: expiringInMonth.length,
      byCategory,
      lowStock,
      expired,
      expiringInMonth
    }
  });
});

// Lab test report
exports.getLabTestReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Default to last 30 days if no dates provided
  const currentDate = new Date();
  const defaultStartDate = new Date(currentDate);
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const start = startDate ? new Date(startDate) : defaultStartDate;
  const end = endDate ? new Date(endDate) : currentDate;
  
  // Get lab tests in date range
  const labTests = await LabTest.find({
    createdAt: {
      $gte: start,
      $lte: end
    }
  })
    .populate('patient', 'name')
    .populate('orderedBy', 'name specialization');
  
  // Group by test type
  const byTestType = {};
  
  labTests.forEach(test => {
    const testType = test.testType;
    
    if (!byTestType[testType]) {
      byTestType[testType] = {
        count: 0,
        completed: 0,
        pending: 0,
        cancelled: 0
      };
    }
    
    byTestType[testType].count++;
    
    if (test.status === 'completed') byTestType[testType].completed++;
    else if (test.status === 'cancelled') byTestType[testType].cancelled++;
    else byTestType[testType].pending++;
  });
  
  // Group by status
  const byStatus = {
    ordered: labTests.filter(test => test.status === 'ordered').length,
    collected: labTests.filter(test => test.status === 'collected').length,
    processing: labTests.filter(test => test.status === 'processing').length,
    completed: labTests.filter(test => test.status === 'completed').length,
    cancelled: labTests.filter(test => test.status === 'cancelled').length
  };
  
  // Group by day
  const byDay = {};
  labTests.forEach(test => {
    const date = test.createdAt.toISOString().split('T')[0];
    
    if (!byDay[date]) {
      byDay[date] = {
        count: 0,
        completed: 0,
        pending: 0,
        cancelled: 0
      };
    }
    
    byDay[date].count++;
    
    if (test.status === 'completed') byDay[date].completed++;
    else if (test.status === 'cancelled') byDay[date].cancelled++;
    else byDay[date].pending++;
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      startDate: start,
      endDate: end,
      totalTests: labTests.length,
      byStatus,
      byTestType,
      byDay
    }
  });
});

// Prescription report
exports.getPrescriptionReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, doctorId } = req.query;
  
  // Default to last 30 days if no dates provided
  const currentDate = new Date();
  const defaultStartDate = new Date(currentDate);
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const start = startDate ? new Date(startDate) : defaultStartDate;
  const end = endDate ? new Date(endDate) : currentDate;
  
  // Filter for specific doctor if provided
  const doctorFilter = doctorId ? { doctor: doctorId } : {};
  
  // Get prescriptions in date range
  const prescriptions = await Prescription.find({
    ...doctorFilter,
    createdAt: {
      $gte: start,
      $lte: end
    }
  })
    .populate('patient', 'name')
    .populate('doctor', 'name specialization')
    .populate('medications.medication', 'name category');
  
  // Group by status
  const byStatus = {
    pending: prescriptions.filter(p => p.status === 'pending').length,
    filled: prescriptions.filter(p => p.status === 'filled').length,
    completed: prescriptions.filter(p => p.status === 'completed').length,
    denied: prescriptions.filter(p => p.status === 'denied').length
  };
  
  // Group by doctor
  const byDoctor = {};
  prescriptions.forEach(prescription => {
    if (prescription.doctor) {
      const id = prescription.doctor._id.toString();
      
      if (!byDoctor[id]) {
        byDoctor[id] = {
          doctor: {
            id,
            name: prescription.doctor.name,
            specialization: prescription.doctor.specialization
          },
          count: 0,
          filled: 0,
          denied: 0
        };
      }
      
      byDoctor[id].count++;
      
      if (prescription.status === 'filled' || prescription.status === 'completed') {
        byDoctor[id].filled++;
      }
      
      if (prescription.status === 'denied') {
        byDoctor[id].denied++;
      }
    }
  });
  
  // Group by medication category
  const byMedicationCategory = {};
  prescriptions.forEach(prescription => {
    prescription.medications.forEach(med => {
      if (med.medication && med.medication.category) {
        const category = med.medication.category;
        
        if (!byMedicationCategory[category]) {
          byMedicationCategory[category] = {
            count: 0,
            quantity: 0
          };
        }
        
        byMedicationCategory[category].count++;
        byMedicationCategory[category].quantity += med.quantity || 0;
      }
    });
  });
  
  // Most prescribed medications
  const medicationCounts = {};
  prescriptions.forEach(prescription => {
    prescription.medications.forEach(med => {
      if (med.medication) {
        const id = med.medication._id.toString();
        const name = med.medication.name;
        
        if (!medicationCounts[id]) {
          medicationCounts[id] = {
            id,
            name,
            count: 0,
            quantity: 0
          };
        }
        
        medicationCounts[id].count++;
        medicationCounts[id].quantity += med.quantity || 0;
      }
    });
  });
  
  const topMedications = Object.values(medicationCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  res.status(200).json({
    status: 'success',
    data: {
      startDate: start,
      endDate: end,
      totalPrescriptions: prescriptions.length,
      byStatus,
      byDoctor,
      byMedicationCategory,
      topMedications
    }
  });
});

// Financial summary report
exports.getFinancialSummaryReport = catchAsync(async (req, res, next) => {
  const { year, month } = req.query;
  
  // Default to current year and month
  const currentDate = new Date();
  const targetYear = year ? parseInt(year) : currentDate.getFullYear();
  const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
  
  // Start of period
  let startDate, endDate;
  
  if (month) {
    // Monthly report
    startDate = new Date(targetYear, targetMonth, 1);
    endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
  } else {
    // Yearly report
    startDate = new Date(targetYear, 0, 1);
    endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
  }
  
  // Get revenue data (from payments)
  const payments = await Payment.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  });
  
  // Get bills data
  const bills = await Bill.find({
    createdAt: {
      $gte: startDate,
      $lte: endDate
    }
  });
  
  // Calculate revenue
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  
  // Calculate receivables (billed but not paid)
  const totalBilled = bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
  const totalReceivables = bills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
  
  // Group by month if yearly report
  let monthlyData = {};
  
  if (!month) {
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(targetYear, i, 1);
      const monthEnd = new Date(targetYear, i + 1, 0, 23, 59, 59, 999);
      
      const monthPayments = payments.filter(payment => 
        payment.createdAt >= monthStart && payment.createdAt <= monthEnd
      );
      
      const monthBills = bills.filter(bill =>
        bill.createdAt >= monthStart && bill.createdAt <= monthEnd
      );
      
      const monthRevenue = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const monthBilled = monthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
      const monthReceivables = monthBills.reduce((sum, bill) => sum + bill.remainingAmount, 0);
      
      monthlyData[i + 1] = {
        revenue: monthRevenue,
        billed: monthBilled,
        receivables: monthReceivables
      };
    }
  }
  
  // Get service-type breakdown from bills
  const serviceBreakdown = {};
  
  bills.forEach(bill => {
    if (bill.items && Array.isArray(bill.items)) {
      bill.items.forEach(item => {
        const serviceType = item.type || 'Other';
        
        if (!serviceBreakdown[serviceType]) {
          serviceBreakdown[serviceType] = {
            count: 0,
            amount: 0
          };
        }
        
        serviceBreakdown[serviceType].count++;
        serviceBreakdown[serviceType].amount += item.amount || 0;
      });
    }
  });
  
  res.status(200).json({
    status: 'success',
    data: {
      period: month ? `${targetYear}-${targetMonth + 1}` : targetYear.toString(),
      totalRevenue,
      totalBilled,
      totalReceivables,
      collectionRate: totalBilled > 0 ? ((totalBilled - totalReceivables) / totalBilled) * 100 : 0,
      serviceBreakdown,
      ...(month ? {} : { monthlyData })
    }
  });
});

// Operational efficiency report
exports.getOperationalEfficiencyReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  // Default to last 30 days if no dates provided
  const currentDate = new Date();
  const defaultStartDate = new Date(currentDate);
  defaultStartDate.setDate(defaultStartDate.getDate() - 30);
  
  const start = startDate ? new Date(startDate) : defaultStartDate;
  const end = endDate ? new Date(endDate) : currentDate;
  
  // Get appointments in date range
  const appointments = await Appointment.find({
    appointmentDate: {
      $gte: start,
      $lte: end
    }
  });
  
  // Calculate appointment metrics
  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter(app => app.status === 'completed').length;
  const cancelledAppointments = appointments.filter(app => app.status === 'cancelled').length;
  const noShowAppointments = appointments.filter(app => app.status === 'no-show').length;
  
  // Calculate wait times
  let totalWaitTime = 0;
  let waitTimeCount = 0;
  
  appointments.forEach(app => {
    if (app.scheduledTime && app.startTime) {
      const scheduled = new Date(app.scheduledTime);
      const started = new Date(app.startTime);
      const waitTime = (started - scheduled) / (1000 * 60); // in minutes
      
      // Only count positive wait times (negative would mean started early)
      if (waitTime > 0) {
        totalWaitTime += waitTime;
        waitTimeCount++;
      }
    }
  });
  
  const averageWaitTime = waitTimeCount > 0 ? totalWaitTime / waitTimeCount : 0;
  
 // Calculate consultation times
 let totalConsultationTime = 0;
 let consultationCount = 0;
 
 appointments.forEach(app => {
   if (app.startTime && app.endTime && app.status === 'completed') {
     const started = new Date(app.startTime);
     const ended = new Date(app.endTime);
     const duration = (ended - started) / (1000 * 60); // in minutes
     
     // Only count reasonable durations (over 0 and less than 3 hours)
     if (duration > 0 && duration < 180) {
       totalConsultationTime += duration;
       consultationCount++;
     }
   }
 });
 
 const averageConsultationTime = consultationCount > 0 ? totalConsultationTime / consultationCount : 0;
 
 // Calculate completion rate
 const completionRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0;
 
 // Calculate cancellation rate
 const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0;
 
 // Calculate no-show rate
 const noShowRate = totalAppointments > 0 ? (noShowAppointments / totalAppointments) * 100 : 0;
 
 // Get lab test turnaround times
 const labTests = await LabTest.find({
   createdAt: {
     $gte: start,
     $lte: end
   },
   status: 'completed'
 });
 
 let totalLabTurnaroundTime = 0;
 let labTestCount = 0;
 
 labTests.forEach(test => {
   if (test.createdAt && test.completedAt) {
     const ordered = new Date(test.createdAt);
     const completed = new Date(test.completedAt);
     const duration = (completed - ordered) / (1000 * 60 * 60); // in hours
     
     // Only count reasonable durations (over 0 and less than 7 days)
     if (duration > 0 && duration < 168) {
       totalLabTurnaroundTime += duration;
       labTestCount++;
     }
   }
 });
 
 const averageLabTurnaroundTime = labTestCount > 0 ? totalLabTurnaroundTime / labTestCount : 0;
 
 // Get prescription fulfillment times
 const prescriptions = await Prescription.find({
   createdAt: {
     $gte: start,
     $lte: end
   },
   status: { $in: ['filled', 'completed'] }
 });
 
 let totalPrescriptionTurnaroundTime = 0;
 let prescriptionCount = 0;
 
 prescriptions.forEach(prescription => {
   if (prescription.createdAt && prescription.dispensedAt) {
     const created = new Date(prescription.createdAt);
     const dispensed = new Date(prescription.dispensedAt);
     const duration = (dispensed - created) / (1000 * 60); // in minutes
     
     // Only count reasonable durations (over 0 and less than 24 hours)
     if (duration > 0 && duration < 1440) {
       totalPrescriptionTurnaroundTime += duration;
       prescriptionCount++;
     }
   }
 });
 
 const averagePrescriptionTime = prescriptionCount > 0 ? totalPrescriptionTurnaroundTime / prescriptionCount : 0;
 
 // Doctor utilization
 const doctorUtilization = {};
 
 // Group appointments by doctor and day
 appointments.forEach(app => {
   if (app.doctor && app.appointmentDate) {
     const doctorId = app.doctor.toString();
     const date = app.appointmentDate.toISOString().split('T')[0];
     const key = `${doctorId}-${date}`;
     
     if (!doctorUtilization[key]) {
       doctorUtilization[key] = {
         doctorId,
         date,
         scheduledMinutes: 0,
         actualMinutes: 0
       };
     }
     
     // Add scheduled time (assume 15 minutes per appointment if not specified)
     doctorUtilization[key].scheduledMinutes += 15;
     
     // Add actual time if completed
     if (app.status === 'completed' && app.startTime && app.endTime) {
       const started = new Date(app.startTime);
       const ended = new Date(app.endTime);
       const duration = (ended - started) / (1000 * 60); // in minutes
       
       if (duration > 0 && duration < 180) {
         doctorUtilization[key].actualMinutes += duration;
       }
     }
   }
 });
 
 // Calculate average utilization
 let totalUtilizationRate = 0;
 const utilizationEntries = Object.values(doctorUtilization);
 
 utilizationEntries.forEach(entry => {
   if (entry.scheduledMinutes > 0) {
     entry.utilizationRate = (entry.actualMinutes / entry.scheduledMinutes) * 100;
     totalUtilizationRate += entry.utilizationRate;
   } else {
     entry.utilizationRate = 0;
   }
 });
 
 const averageUtilizationRate = utilizationEntries.length > 0 ? totalUtilizationRate / utilizationEntries.length : 0;
 
 res.status(200).json({
   status: 'success',
   data: {
     startDate: start,
     endDate: end,
     appointmentMetrics: {
       total: totalAppointments,
       completed: completedAppointments,
       cancelled: cancelledAppointments,
       noShow: noShowAppointments,
       completionRate,
       cancellationRate,
       noShowRate
     },
     timeMetrics: {
       averageWaitTime,
       averageConsultationTime,
       averageLabTurnaroundTime,
       averagePrescriptionTime
     },
     utilizationMetrics: {
       averageUtilizationRate
     }
   }
 });
});

// Custom period comparison report
exports.getPeriodComparisonReport = catchAsync(async (req, res, next) => {
 const { 
   startDate1, endDate1, 
   startDate2, endDate2,
   metrics 
 } = req.query;
 
 if (!startDate1 || !endDate1 || !startDate2 || !endDate2) {
   return next(new AppError('Both period start and end dates are required', 400));
 }
 
 const period1Start = new Date(startDate1);
 const period1End = new Date(endDate1);
 const period2Start = new Date(startDate2);
 const period2End = new Date(endDate2);
 
 // Validate dates
 if (period1Start > period1End || period2Start > period2End) {
   return next(new AppError('Start date cannot be after end date for either period', 400));
 }
 
 // Default metrics if not provided
 const metricsToCompare = metrics ? metrics.split(',') : [
   'appointments', 'revenue', 'prescriptions', 'labTests'
 ];
 
 const result = {
   period1: {
     start: period1Start,
     end: period1End
   },
   period2: {
     start: period2Start,
     end: period2End
   },
   comparison: {}
 };
 
 // Get appointment metrics if requested
 if (metricsToCompare.includes('appointments')) {
   // Period 1
   const appointments1 = await Appointment.find({
     appointmentDate: {
       $gte: period1Start,
       $lte: period1End
     }
   });
   
   const appointments1Total = appointments1.length;
   const appointments1Completed = appointments1.filter(app => app.status === 'completed').length;
   const appointments1Cancelled = appointments1.filter(app => app.status === 'cancelled').length;
   const appointments1NoShow = appointments1.filter(app => app.status === 'no-show').length;
   
   // Period 2
   const appointments2 = await Appointment.find({
     appointmentDate: {
       $gte: period2Start,
       $lte: period2End
     }
   });
   
   const appointments2Total = appointments2.length;
   const appointments2Completed = appointments2.filter(app => app.status === 'completed').length;
   const appointments2Cancelled = appointments2.filter(app => app.status === 'cancelled').length;
   const appointments2NoShow = appointments2.filter(app => app.status === 'no-show').length;
   
   // Calculate percentage changes
   const appointmentsTotalChange = calculatePercentageChange(appointments1Total, appointments2Total);
   const appointmentsCompletedChange = calculatePercentageChange(appointments1Completed, appointments2Completed);
   const appointmentsCancelledChange = calculatePercentageChange(appointments1Cancelled, appointments2Cancelled);
   const appointmentsNoShowChange = calculatePercentageChange(appointments1NoShow, appointments2NoShow);
   
   result.comparison.appointments = {
     period1: {
       total: appointments1Total,
       completed: appointments1Completed,
       cancelled: appointments1Cancelled,
       noShow: appointments1NoShow
     },
     period2: {
       total: appointments2Total,
       completed: appointments2Completed,
       cancelled: appointments2Cancelled,
       noShow: appointments2NoShow
     },
     changes: {
       total: appointmentsTotalChange,
       completed: appointmentsCompletedChange,
       cancelled: appointmentsCancelledChange,
       noShow: appointmentsNoShowChange
     }
   };
 }
 
 // Get revenue metrics if requested
 if (metricsToCompare.includes('revenue')) {
   // Period 1
   const payments1 = await Payment.find({
     createdAt: {
       $gte: period1Start,
       $lte: period1End
     }
   });
   
   const revenue1 = payments1.reduce((sum, payment) => sum + payment.amount, 0);
   
   // Period 2
   const payments2 = await Payment.find({
     createdAt: {
       $gte: period2Start,
       $lte: period2End
     }
   });
   
   const revenue2 = payments2.reduce((sum, payment) => sum + payment.amount, 0);
   
   // Calculate percentage change
   const revenueChange = calculatePercentageChange(revenue1, revenue2);
   
   result.comparison.revenue = {
     period1: {
       total: revenue1,
       count: payments1.length
     },
     period2: {
       total: revenue2,
       count: payments2.length
     },
     changes: {
       total: revenueChange,
       count: calculatePercentageChange(payments1.length, payments2.length)
     }
   };
 }
 
 // Get prescription metrics if requested
 if (metricsToCompare.includes('prescriptions')) {
   // Period 1
   const prescriptions1 = await Prescription.find({
     createdAt: {
       $gte: period1Start,
       $lte: period1End
     }
   });
   
   const prescriptions1Total = prescriptions1.length;
   const prescriptions1Filled = prescriptions1.filter(p => 
     p.status === 'filled' || p.status === 'completed'
   ).length;
   
   // Period 2
   const prescriptions2 = await Prescription.find({
     createdAt: {
       $gte: period2Start,
       $lte: period2End
     }
   });
   
   const prescriptions2Total = prescriptions2.length;
   const prescriptions2Filled = prescriptions2.filter(p => 
     p.status === 'filled' || p.status === 'completed'
   ).length;
   
   // Calculate percentage changes
   const prescriptionsTotalChange = calculatePercentageChange(prescriptions1Total, prescriptions2Total);
   const prescriptionsFilledChange = calculatePercentageChange(prescriptions1Filled, prescriptions2Filled);
   
   result.comparison.prescriptions = {
     period1: {
       total: prescriptions1Total,
       filled: prescriptions1Filled
     },
     period2: {
       total: prescriptions2Total,
       filled: prescriptions2Filled
     },
     changes: {
       total: prescriptionsTotalChange,
       filled: prescriptionsFilledChange
     }
   };
 }
 
 // Get lab test metrics if requested
 if (metricsToCompare.includes('labTests')) {
   // Period 1
   const labTests1 = await LabTest.find({
     createdAt: {
       $gte: period1Start,
       $lte: period1End
     }
   });
   
   const labTests1Total = labTests1.length;
   const labTests1Completed = labTests1.filter(test => test.status === 'completed').length;
   
   // Period 2
   const labTests2 = await LabTest.find({
     createdAt: {
       $gte: period2Start,
       $lte: period2End
     }
   });
   
   const labTests2Total = labTests2.length;
   const labTests2Completed = labTests2.filter(test => test.status === 'completed').length;
   
   // Calculate percentage changes
   const labTestsTotalChange = calculatePercentageChange(labTests1Total, labTests2Total);
   const labTestsCompletedChange = calculatePercentageChange(labTests1Completed, labTests2Completed);
   
   result.comparison.labTests = {
     period1: {
       total: labTests1Total,
       completed: labTests1Completed
     },
     period2: {
       total: labTests2Total,
       completed: labTests2Completed
     },
     changes: {
       total: labTestsTotalChange,
       completed: labTestsCompletedChange
     }
   };
 }
 
 res.status(200).json({
   status: 'success',
   data: result
 });
});

// Helper function to calculate percentage change
function calculatePercentageChange(oldValue, newValue) {
 if (oldValue === 0) {
   return newValue === 0 ? 0 : 100; // If oldValue is 0, any increase is 100%
 }
 
 return ((newValue - oldValue) / oldValue) * 100;
}