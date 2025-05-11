// src/tests/integration/auth.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const RefreshToken = require('../../models/RefreshToken');
const { createTestHospital, createTestUser } = require('../helpers');
const config = require('../../config/config');

describe('Authentication API Endpoints', () => {
  let testHospital;

  beforeAll(async () => {
    testHospital = await createTestHospital();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return access token', async () => {
      const userData = {
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration.test@example.com',
        password: 'SecurePassword123!',
        phoneNumber: '555-123-4567',
        role: 'admin',
        hospitalId: testHospital._id.toString()
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.expiresIn).toBeDefined();

      // Verify refresh token cookie was set
      const cookies = response.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');

      // Check if user is saved in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.firstName).toBe(userData.firstName);
      expect(user.role).toBe(userData.role);

      // Check if access token is valid
      const decoded = jwt.verify(response.body.accessToken, config.jwt.secret);
      expect(decoded.userId).toBeDefined();
      expect(decoded.role).toBe(userData.role);
    });

    it('should return 400 if user already exists', async () => {
      // Create a user
      const existingUser = await createTestUser({
        email: 'existing.integration@example.com'
      });

      // Try to register the same user again
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Duplicate',
          lastName: 'User',
          email: existingUser.email,
          password: 'Password123!',
          phoneNumber: '555-987-6543',
          role: 'doctor',
          hospitalId: testHospital._id.toString()
        })
        .expect(400);

      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'Missing',
          email: 'missing.fields@example.com',
          // Missing lastName, password, and hospitalId
          role: 'patient'
        })
        .expect(400);

      expect(response.body.message).toContain('failed');
    });
  });

  describe('POST /api/auth/login', () => {
    const password = 'LoginTestPass123!';
    let testUser;

    beforeAll(async () => {
      testUser = await createTestUser({
        email: 'login.integration@example.com',
        password
      });
    });

    it('should login user and return access token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.hospital).toBeDefined();

      // Verify refresh token cookie was set
      const cookies = response.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
      expect(refreshTokenCookie).toBeDefined();
      expect(refreshTokenCookie).toContain('HttpOnly');

      // Check last login was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.lastLogin).toBeDefined();
    });

    it('should return 401 with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword'
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid credentials');
    });

    it('should return 404 if user not found', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        })
        .expect(404);

      expect(response.body.message).toContain('User not found');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    const password = 'RefreshTokenPass123!';
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      // Create user and login to get refresh token
      testUser = await createTestUser({
        email: 'refresh.integration@example.com',
        password
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password
        });

      // Extract refresh token from cookies
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
      refreshToken = refreshTokenCookie ? refreshTokenCookie.split(';')[0].split('=')[1] : null;
    });

    it('should issue new access token with valid refresh token', async () => {
      // Wait a bit to ensure the tokens are different
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.expiresIn).toBeDefined();

      // Verify the new token is different
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password
        });

      expect(response.body.accessToken).not.toBe(loginResponse.body.accessToken);
    });

    it('should return 401 with no refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .expect(401);

      expect(response.body.message).toContain('Refresh token is required');
    });

    it('should return 403 with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', ['refreshToken=invalid-token'])
        .expect(403);

      expect(response.body.message).toContain('Invalid or expired refresh token');
    });
  });

  describe('POST /api/auth/logout', () => {
    let testUser;
    let refreshToken;

    beforeEach(async () => {
      // Create user and login to get refresh token
      testUser = await createTestUser({
        email: 'logout.integration@example.com',
        password: 'LogoutTest123!'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'LogoutTest123!'
        });

      // Extract refresh token from cookies
      const cookies = loginResponse.headers['set-cookie'] || [];
      const refreshTokenCookie = cookies.find(c => c.includes('refreshToken='));
      refreshToken = refreshTokenCookie ? refreshTokenCookie.split(';')[0].split('=')[1] : null;
    });

    it('should clear refresh token cookie and revoke token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');

      // Check that cookie was cleared
      const cookies = response.headers['set-cookie'] || [];
      const clearedCookie = cookies.find(c => c.includes('refreshToken='));
      expect(clearedCookie).toBeDefined();
      expect(clearedCookie).toContain('refreshToken=;'); // Empty value

      // Check if token was revoked in database
      const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
      expect(tokenDoc?.isRevoked).toBe(true);
    });

    it('should succeed even without a refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(200);

      expect(response.body.message).toContain('Logged out successfully');
    });
  });

  describe('GET /api/auth/me', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      // Create user and generate access token
      testUser = await createTestUser({
        email: 'me.endpoint@example.com',
        password: 'MeTest123!'
      });

      accessToken = jwt.sign(
        { userId: testUser._id, role: testUser.role, hospitalId: testUser.hospital },
        config.jwt.secret,
        { expiresIn: '15m' }
      );
    });

    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.user).toBeDefined();
      expect(response.body.user._id.toString()).toBe(testUser._id.toString());
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.message).toContain('No auth token');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.message).toContain('Invalid token');
    });
  });

  describe('POST /api/auth/revoke-all-sessions', () => {
    let testUser;
    let accessToken;

    beforeEach(async () => {
      // Create user and generate access token
      testUser = await createTestUser({
        email: 'revoke.sessions@example.com',
        password: 'RevokeTest123!'
      });

      accessToken = jwt.sign(
        { userId: testUser._id, role: testUser.role, hospitalId: testUser.hospital },
        config.jwt.secret,
        { expiresIn: '15m' }
      );

      // Create multiple refresh tokens for this user
      await RefreshToken.create([
        {
          token: 'token1',
          user: testUser._id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isRevoked: false
        },
        {
          token: 'token2',
          user: testUser._id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isRevoked: false
        }
      ]);
    });

    it('should revoke all refresh tokens for the user', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-all-sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.message).toContain('All sessions revoked');

      // Check that all tokens were revoked
      const tokens = await RefreshToken.find({ user: testUser._id });
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every(token => token.isRevoked)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/revoke-all-sessions')
        .expect(401);

      expect(response.body.message).toContain('No auth token');
    });
  });
});