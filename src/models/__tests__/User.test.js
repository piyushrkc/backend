// src/models/__tests__/User.test.js
const mongoose = require('mongoose');
const User = require('../User');
const { createTestHospital } = require('../../tests/helpers');

describe('User Model', () => {
  let hospital;

  beforeAll(async () => {
    hospital = await createTestHospital();
  });

  it('should create a user successfully', async () => {
    const userData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      phoneNumber: '123-456-7890',
      role: 'admin',
      hospital: hospital._id,
      isActive: true
    };

    const user = new User(userData);
    const savedUser = await user.save();

    // Check if the user was saved correctly
    expect(savedUser._id).toBeDefined();
    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.lastName).toBe(userData.lastName);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.password).not.toBe(userData.password); // Password should be hashed
    expect(savedUser.isActive).toBe(true);
  });

  it('should require firstName, lastName, email, password', async () => {
    const user = new User({
      role: 'admin',
      hospital: hospital._id
    });

    // Validate should fail because required fields are missing
    let validationError;
    try {
      await user.validate();
    } catch (error) {
      validationError = error;
    }

    expect(validationError).toBeDefined();
    expect(validationError.errors.firstName).toBeDefined();
    expect(validationError.errors.lastName).toBeDefined();
    expect(validationError.errors.email).toBeDefined();
    expect(validationError.errors.password).toBeDefined();
  });

  it('should not allow duplicate emails', async () => {
    // Create first user
    const userData = {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'duplicate@example.com',
      password: 'Password123!',
      phoneNumber: '987-654-3210',
      role: 'doctor',
      hospital: hospital._id
    };

    await new User(userData).save();

    // Try to create second user with same email
    const duplicateUser = new User({
      ...userData,
      firstName: 'John',
      lastName: 'Smith'
    });

    // The save should fail because of duplicate email
    await expect(duplicateUser.save()).rejects.toThrow();
  });

  it('should hash the password before saving', async () => {
    const originalPassword = 'TestPassword123!';
    
    const user = new User({
      firstName: 'Password',
      lastName: 'Hasher',
      email: 'password.test@example.com',
      password: originalPassword,
      role: 'nurse',
      hospital: hospital._id
    });

    const savedUser = await user.save();

    // Password should be hashed
    expect(savedUser.password).not.toBe(originalPassword);
    expect(savedUser.password).toMatch(/^\$2[aby]\$\d+\$/); // Bcrypt hash pattern
  });

  it('should correctly compare passwords', async () => {
    const originalPassword = 'CompareTest123!';
    
    const user = new User({
      firstName: 'Compare',
      lastName: 'Test',
      email: 'compare.test@example.com',
      password: originalPassword,
      role: 'receptionist',
      hospital: hospital._id
    });

    const savedUser = await user.save();

    // Test password comparison
    const correctMatch = await savedUser.comparePassword(originalPassword);
    const incorrectMatch = await savedUser.comparePassword('WrongPassword');

    expect(correctMatch).toBe(true);
    expect(incorrectMatch).toBe(false);
  });

  it('should convert to JSON without sensitive fields', async () => {
    const user = new User({
      firstName: 'JSON',
      lastName: 'Convert',
      email: 'json.test@example.com',
      password: 'JSONTest123!',
      role: 'patient',
      hospital: hospital._id
    });

    const savedUser = await user.save();
    const userJSON = savedUser.toJSON();

    // Password should not be included in JSON
    expect(userJSON.password).toBeUndefined();
    
    // Other fields should be included
    expect(userJSON.firstName).toBe('JSON');
    expect(userJSON.lastName).toBe('Convert');
    expect(userJSON.email).toBe('json.test@example.com');
  });
});