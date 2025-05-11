// src/scripts/updateIndexes.js
require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');

/**
 * Script to update MongoDB indexes for better query performance
 * This script should be run after model changes to ensure indexes are created in the database
 */

console.log('Starting database index update...');
console.log('Connecting to database:', config.db.uri);

mongoose.connect(config.db.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to database. Creating indexes...');
  
  try {
    // Update indexes for each model
    console.log('Creating User indexes...');
    await User.syncIndexes();
    
    console.log('Creating Patient indexes...');
    await Patient.syncIndexes();
    
    console.log('Creating Appointment indexes...');
    await Appointment.syncIndexes();
    
    console.log('Creating Prescription indexes...');
    await Prescription.syncIndexes();
    
    console.log('All indexes created successfully!');
    
    // Log index information
    console.log('\nIndex information:');
    
    console.log('\nUser collection indexes:');
    const userIndexes = await mongoose.connection.db.collection('users').indexes();
    console.log(userIndexes);
    
    console.log('\nPatient collection indexes:');
    const patientIndexes = await mongoose.connection.db.collection('patients').indexes();
    console.log(patientIndexes);
    
    console.log('\nAppointment collection indexes:');
    const appointmentIndexes = await mongoose.connection.db.collection('appointments').indexes();
    console.log(appointmentIndexes);
    
    console.log('\nPrescription collection indexes:');
    const prescriptionIndexes = await mongoose.connection.db.collection('prescriptions').indexes();
    console.log(prescriptionIndexes);
    
    console.log('\nIndex update complete!');
  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed.');
  }
})
.catch(err => {
  console.error('Error connecting to database:', err);
  process.exit(1);
});