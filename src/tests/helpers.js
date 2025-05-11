// src/tests/helpers.js
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const config = require('../config/config');

/**
 * Create a test hospital
 * @returns {Promise<object>} The created hospital document
 */
const createTestHospital = async () => {
  const hospital = new Hospital({
    name: 'Test Hospital',
    subdomain: 'test',
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'Test Country'
    },
    contactInfo: {
      email: 'test@hospital.com',
      phone: '123-456-7890'
    },
    isActive: true
  });
  
  await hospital.save();
  return hospital;
};

/**
 * Create a test user
 * @param {object} customData - Custom user data to override defaults
 * @returns {Promise<object>} The created user document
 */
const createTestUser = async (customData = {}) => {
  const hospital = await createTestHospital();
  
  const defaultUserData = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: 'Password123!',
    phoneNumber: '123-456-7890',
    role: 'admin',
    hospital: hospital._id,
    isActive: true
  };
  
  const userData = { ...defaultUserData, ...customData };
  const user = new User(userData);
  
  await user.save();
  return user;
};

/**
 * Generate a JWT token for test authentication
 * @param {object} user - User object to generate token for
 * @returns {string} JWT token
 */
const generateAuthToken = (user) => {
  return jwt.sign(
    { userId: user._id, role: user.role, hospitalId: user.hospital },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
};

/**
 * Create an authenticated request
 * @param {object} user - User to authenticate as
 * @returns {object} Supertest request object with auth header
 */
const authenticatedRequest = (user) => {
  const token = generateAuthToken(user);
  return request(app).set('Authorization', `Bearer ${token}`);
};

module.exports = {
  createTestHospital,
  createTestUser,
  generateAuthToken,
  authenticatedRequest
};