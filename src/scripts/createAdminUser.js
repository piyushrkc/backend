// src/scripts/createAdminUser.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const config = require('../config/config');

/**
 * Script to create an admin user in the database
 * Run with: node src/scripts/createAdminUser.js
 */

const createAdminUser = async () => {
  try {
    // If we're running without database (indicated by global flag)
    if (global.RUNNING_WITHOUT_DB === true) {
      console.log('Skipping admin user creation - running without database');
      return;
    }

    // Check if Mongoose is connected
    if (mongoose.connection.readyState !== 1) {
      console.log('MongoDB is not connected. Skipping admin user creation.');
      return;
    }

    console.log('Creating admin user in connected database...');

    // Check if default hospital exists, create it if not
    let hospital = await Hospital.findOne({ isDefault: true });

    // If no default hospital, check for one with subdomain 'general'
    if (!hospital) {
      hospital = await Hospital.findOne({ subdomain: 'general' });
    }

    if (!hospital) {
      console.log('Creating default hospital...');
      try {
        hospital = await Hospital.create({
          name: 'General Hospital',
          subdomain: 'general',
          type: 'private',
          size: 'medium',
          isDefault: true,
          address: {
            street: '123 Healthcare Avenue',
            city: 'Medical District',
            state: 'Health State',
            zipCode: '12345',
            country: 'India'
          },
          contactInfo: {
            email: 'info@generalhospital.com',
            phone: '(123) 456-7890',
            website: 'www.generalhospital.com'
          },
          settings: {
            workingHours: {
              monday: { start: '09:00', end: '17:00' },
              tuesday: { start: '09:00', end: '17:00' },
              wednesday: { start: '09:00', end: '17:00' },
              thursday: { start: '09:00', end: '17:00' },
              friday: { start: '09:00', end: '17:00' },
              saturday: { start: '09:00', end: '13:00' },
              sunday: { start: '', end: '' }
            },
            appointmentDuration: 30
          },
          isActive: true
        });
        console.log('Default hospital created:', hospital._id);
      } catch (err) {
        // If hospital creation fails, try to find it again (in case of race condition)
        if (err.code === 11000) { // Duplicate key error
          hospital = await Hospital.findOne({ subdomain: 'general' });
          if (!hospital) {
            throw new Error('Failed to create or find default hospital');
          }
          console.log('Using existing hospital with subdomain "general"');
        } else {
          throw err;
        }
      }
    }

    // Check if admin user already exists
    const adminEmail = process.env.ADMIN_EMAIL || 'piyushrkc@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ABC123xyz';

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists.');

      try {
        // Update admin password if needed and password exists
        if (existingAdmin.password) {
          const passwordMatch = await bcrypt.compare(adminPassword, existingAdmin.password);

          if (!passwordMatch) {
            console.log('Updating admin password...');
            existingAdmin.password = await bcrypt.hash(adminPassword, 12);
            await existingAdmin.save();
            console.log('Admin password updated successfully.');
          }
        } else {
          // Handle case where user exists but has no password
          console.log('Admin exists but has no password. Setting password...');
          existingAdmin.password = await bcrypt.hash(adminPassword, 12);
          await existingAdmin.save();
          console.log('Admin password set successfully.');
        }
      } catch (err) {
        console.log('Error handling admin password, setting a new one:', err.message);
        existingAdmin.password = await bcrypt.hash(adminPassword, 12);
        await existingAdmin.save();
        console.log('Admin password reset successfully.');
      }
    } else {
      // Create admin user
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      const adminUser = new User({
        firstName: 'Piyush',
        lastName: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        hospital: hospital._id,
        isActive: true,
        isEmailVerified: true,
        lastLogin: new Date()
      });

      await adminUser.save();
      console.log('Admin user created successfully.');
    }

    // Only disconnect from MongoDB if this script is run directly
    if (require.main === module) {
      await mongoose.disconnect();
      console.log('MongoDB Disconnected');
    }

  } catch (error) {
    console.error('Error creating admin user:', error);

    // Don't exit in production/Vercel environment
    if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
      process.exit(1);
    }
  }
};

// Run the function if this file is executed directly
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;