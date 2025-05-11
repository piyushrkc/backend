const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { catchAsync } = require('../utils/errorHandlers');
const AppError = require('../utils/appError');

// Create a new doctor
exports.createDoctor = catchAsync(async (req, res, next) => {
  const newDoctor = await Doctor.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      doctor: newDoctor
    }
  });
});

// Get all doctors
exports.getAllDoctors = catchAsync(async (req, res, next) => {
  const doctors = await Doctor.find();
  
  res.status(200).json({
    status: 'success',
    results: doctors.length,
    data: {
      doctors
    }
  });
});

// Get a specific doctor
exports.getDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findById(req.params.id);
  
  if (!doctor) {
    return next(new AppError('No doctor found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      doctor
    }
  });
});

// Update doctor information
exports.updateDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });
  
  if (!doctor) {
    return next(new AppError('No doctor found with that ID', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      doctor
    }
  });
});

// Delete a doctor
exports.deleteDoctor = catchAsync(async (req, res, next) => {
  const doctor = await Doctor.findByIdAndDelete(req.params.id);
  
  if (!doctor) {
    return next(new AppError('No doctor found with that ID', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Get doctor's schedule
exports.getDoctorSchedule = catchAsync(async (req, res, next) => {
  const doctorId = req.params.id;
  const { startDate, endDate } = req.query;
  
  const query = { doctor: doctorId };
  
  if (startDate && endDate) {
    query.appointmentDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const appointments = await Appointment.find(query)
    .sort({ appointmentDate: 1, appointmentTime: 1 });
  
  res.status(200).json({
    status: 'success',
    results: appointments.length,
    data: {
      appointments
    }
  });
});

// Set doctor's availability
exports.setAvailability = catchAsync(async (req, res, next) => {
  const doctorId = req.params.id;
  const { availabilitySlots } = req.body;
  
  const doctor = await Doctor.findById(doctorId);
  
  if (!doctor) {
    return next(new AppError('No doctor found with that ID', 404));
  }
  
  doctor.availabilitySlots = availabilitySlots;
  await doctor.save();
  
  res.status(200).json({
    status: 'success',
    data: {
      doctor
    }
  });
});

// Get doctor's patients
exports.getDoctorPatients = catchAsync(async (req, res, next) => {
  const doctorId = req.params.id;
  
  const appointments = await Appointment.find({ doctor: doctorId })
    .populate('patient')
    .select('patient');
    
  // Get unique patients
  const patientMap = {};
  appointments.forEach(appointment => {
    if (appointment.patient) {
      patientMap[appointment.patient._id] = appointment.patient;
    }
  });
  
  const patients = Object.values(patientMap);
  
  res.status(200).json({
    status: 'success',
    results: patients.length,
    data: {
      patients
    }
  });
});

// Get doctor's current queue
exports.getDoctorQueue = catchAsync(async (req, res, next) => {
  const doctorId = req.params.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const appointments = await Appointment.find({
    doctor: doctorId,
    appointmentDate: {
      $gte: today,
      $lt: tomorrow
    },
    status: { $in: ['scheduled', 'in-progress'] }
  })
  .populate('patient', 'name contactNumber')
  .sort({ appointmentTime: 1 });
  
  res.status(200).json({
    status: 'success',
    results: appointments.length,
    data: {
      queue: appointments
    }
  });
});