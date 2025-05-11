// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user with JWT
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
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

// Middleware to check if user has required role
exports.authorize = (...roles) => {
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

// Middleware to ensure user belongs to the correct hospital (tenant)
exports.checkHospital = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // If hospitalId in params exists, check if user belongs to that hospital
  if (req.params.hospitalId && req.params.hospitalId !== req.user.hospitalId.toString()) {
    return res.status(403).json({ message: 'Access denied. You can only access resources from your hospital' });
  }
  
  next();
};