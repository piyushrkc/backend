// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config/config');

/**
 * Helper function to generate access and refresh tokens
 */
const generateTokens = async (user, req) => {
  // Generate access token with shorter expiry
  const accessToken = jwt.sign(
    { 
      userId: user._id, 
      role: user.role, 
      hospitalId: user.hospital._id || user.hospital 
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // Generate refresh token with longer expiry
  const refreshTokenDoc = await RefreshToken.generateToken(
    user._id,
    req.ip,
    req.headers['user-agent'],
    parseInt(config.jwt.refreshExpiresIn) || 7
  );

  return {
    accessToken,
    refreshToken: refreshTokenDoc.token,
    expiresIn: config.jwt.expiresIn
  };
};

// Register user
exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phoneNumber,
      role,
      hospitalId,
      specialization,
      licenseNumber
    } = req.body;

    // For simplicity in testing, create a hospital if not provided
    let hospital;
    if (!hospitalId) {
      // Find existing hospital or create new one
      hospital = await Hospital.findOne({ subdomain: 'general' });
      
      if (!hospital) {
        hospital = new Hospital({
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
        console.log('Created new hospital:', hospital.name);
      }
    } else {
      // Check if the hospital exists
      hospital = await Hospital.findById(hospitalId);
      if (!hospital) {
        return res.status(404).json({ message: 'Hospital not found' });
      }
    }

    // Force overwrite any existing user with this email for testing
    await User.deleteOne({ email });
    
    // Create new user
    const user = new User({
      firstName: firstName || 'Test',
      lastName: lastName || 'User',
      email: email || 'test@example.com',
      password: password || 'password123',
      phoneNumber: phoneNumber || '123-456-7890',
      role: role || 'admin',
      hospital: hospital._id,
      specialization,
      licenseNumber
    });

    await user.save();

    // Load the user with populated hospital for token generation
    const populatedUser = await User.findById(user._id).populate('hospital');
    
    // Generate tokens
    const tokens = await generateTokens(populatedUser, req);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'User registered successfully',
      accessToken: tokens.accessToken,
      user: populatedUser.toJSON(),
      expiresIn: tokens.expiresIn,
      testCredentials: {
        email: user.email,
        password: password || 'password123'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// Login user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email and explicitly include the password field
    const user = await User.findOne({ email }).select('+password').populate('hospital', 'name subdomain');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate access and refresh tokens
    const tokens = await generateTokens(user, req);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      user: user.toJSON(),
      expiresIn: tokens.expiresIn,
      hospital: {
        id: user.hospital._id,
        name: user.hospital.name,
        subdomain: user.hospital.subdomain
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password')
      .populate('hospital', 'name subdomain');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ message: 'Failed to get user', error: error.message });
  }
};

// Refresh token endpoint - issue a new access token using refresh token
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }
    
    // Verify refresh token exists and is valid
    const foundToken = await RefreshToken.findValidToken(refreshToken);
    
    if (!foundToken) {
      return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
    
    // Check if user agent matches to prevent token theft
    if (foundToken.userAgent && foundToken.userAgent !== req.headers['user-agent']) {
      // Potential token theft - revoke token
      await foundToken.revoke();
      return res.status(403).json({ message: 'Token security check failed' });
    }
    
    // Generate new access token
    const accessToken = jwt.sign(
      { 
        userId: foundToken.user._id, 
        role: foundToken.user.role, 
        hospitalId: foundToken.user.hospital 
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    res.status(200).json({
      accessToken,
      expiresIn: config.jwt.expiresIn
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Failed to refresh token', error: error.message });
  }
};

// Logout
exports.logout = async (req, res) => {
  try {
    // Get refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;
    
    // Clear refresh token cookie regardless of whether token exists
    res.clearCookie('refreshToken');
    
    // If token exists, revoke it in database
    if (refreshToken) {
      const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
      if (tokenDoc) {
        await tokenDoc.revoke();
      }
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed', error: error.message });
  }
};

// Revoke all user sessions
exports.revokeAllSessions = async (req, res) => {
  try {
    // User must be authenticated and token must contain userId
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Revoke all refresh tokens for the user
    await RefreshToken.revokeAllUserTokens(req.user.userId);
    
    // Clear current session cookie
    res.clearCookie('refreshToken');
    
    res.status(200).json({ message: 'All sessions revoked successfully' });
  } catch (error) {
    console.error('Session revocation error:', error);
    res.status(500).json({ message: 'Failed to revoke sessions', error: error.message });
  }
};

// Protect routes - ensure user is authenticated
exports.protect = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    
    // Find user by id
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is disabled' });
    }
    
    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      hospitalId: decoded.hospitalId
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Authentication failed', error: error.message });
  }
};

// Restrict routes to specific roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. ${req.user.role} role is not authorized to access this resource`
      });
    }
    
    next();
  };
};