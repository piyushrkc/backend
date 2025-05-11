// src/scripts/seedHospital.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const Hospital = require('../models/Hospital');
const User = require('../models/User');
const connectDB = require('../config/db');

// Connect to database
connectDB();

const createHospitalAndAdmin = async () => {
  try {
    // Create a hospital
    const hospital = new Hospital({
      name: 'General Hospital',
      subdomain: 'general',
      address: {
        street: '123 Main Street',
        city: 'Anytown',
        state: 'State',
        zipCode: '12345',
        country: 'Country'
      },
      contactInfo: {
        email: 'info@generalhospital.com',
        phone: '123-456-7890',
        website: 'www.generalhospital.com'
      },
      type: 'private',
      size: 'medium',
      settings: {
        workingHours: {
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '17:00' },
          friday: { start: '09:00', end: '17:00' },
          saturday: { start: '09:00', end: '13:00' },
          sunday: { start: '', end: '' }
        }
      }
    });

    await hospital.save();
    console.log('Hospital created:', hospital);

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const admin = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@generalhospital.com',
      password: hashedPassword,
      phoneNumber: '123-456-7890',
      role: 'admin',
      hospital: hospital._id
    });

    await admin.save();
    console.log('Admin user created:', admin);

    console.log('\nInitial setup completed successfully!');
    console.log('\nLogin Credentials:');
    console.log('Email: admin@generalhospital.com');
    console.log('Password: admin123');

  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    mongoose.disconnect();
  }
};

createHospitalAndAdmin();