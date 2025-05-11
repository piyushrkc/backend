// src/controllers/__tests__/authController.test.js
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const { createTestUser, createTestHospital } = require('../../tests/helpers');
const jwt = require('jsonwebtoken');
const config = require('../../config/config');

describe('Auth Controller', () => {
  let testHospital;

  beforeAll(async () => {
    testHospital = await createTestHospital();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        password: 'Password123!',
        phoneNumber: '555-123-4567',
        role: 'doctor',
        hospitalId: testHospital._id.toString()
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Check response
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned

      // Check that user was saved in database
      const savedUser = await User.findOne({ email: userData.email });
      expect(savedUser).toBeTruthy();
      expect(savedUser.firstName).toBe(userData.firstName);
    });

    it('should return 400 if user already exists', async () => {
      // Create a user first
      const existingUser = await createTestUser({
        email: 'existing@example.com'
      });

      // Try to register again with same email
      const userData = {
        firstName: 'Duplicate',
        lastName: 'User',
        email: 'existing@example.com', // Same email
        password: 'Password123!',
        phoneNumber: '555-987-6543',
        role: 'nurse',
        hospitalId: testHospital._id.toString()
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.message).toContain('already exists');
    });

    it('should return 404 if hospital not found', async () => {
      const userData = {
        firstName: 'Invalid',
        lastName: 'Hospital',
        email: 'invalid.hospital@example.com',
        password: 'Password123!',
        phoneNumber: '555-111-2222',
        role: 'admin',
        hospitalId: new mongoose.Types.ObjectId().toString() // Non-existent ID
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(404);

      expect(response.body.message).toContain('Hospital not found');
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;
    const password = 'LoginTest123!';

    beforeEach(async () => {
      // Create a test user before each test
      testUser = await createTestUser({
        email: 'login.test@example.com',
        password
      });
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: testUser.email,
        password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      // Check response
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.hospital).toBeDefined();

      // Check that refresh token cookie was set
      const cookies = response.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(cookie => cookie.includes('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
    });

    it('should return 401 with invalid password', async () => {
      const loginData = {
        email: testUser.email,
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 404 if user not found', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(404);

      expect(response.body.message).toContain('User not found');
    });

    it('should return 403 if user account is disabled', async () => {
      // Update user to be inactive
      testUser.isActive = false;
      await testUser.save();

      const loginData = {
        email: testUser.email,
        password
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(403);

      expect(response.body.message).toContain('Account is disabled');
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser;
    let authToken;

    beforeEach(async () => {
      testUser = await createTestUser({
        email: 'me.test@example.com'
      });

      // Generate auth token
      authToken = jwt.sign(
        { userId: testUser._id, role: testUser.role, hospitalId: testUser.hospital },
        config.jwt.secret,
        { expiresIn: '1h' }
      );
    });

    it('should return current user when authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user._id.toString()).toBe(testUser._id.toString());
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.password).toBeUndefined();
    });

    it('should return 401 if not authenticated', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.message).toContain('No auth token');
    });

    it('should return 401 if token is invalid', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken')
        .expect(401);

      expect(response.body.message).toContain('Invalid token');
    });
  });

  // More tests for refresh token, logout, etc. would follow the same pattern
});