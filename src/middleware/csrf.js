// src/middleware/csrf.js
const csurf = require('csurf');
const config = require('../config/config');

// Configure CSRF protection
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    secure: config.app.env === 'production',
    sameSite: 'strict'
  }
});

// Middleware to handle CSRF errors
const handleCsrfError = (err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    // Handle CSRF token errors
    return res.status(403).json({
      message: 'Invalid CSRF token. Form has been tampered with.',
      error: 'CSRF_ERROR'
    });
  }
  
  // Pass other errors to the next middleware
  return next(err);
};

// Helper to attach CSRF token to response
const attachCsrfToken = (req, res, next) => {
  // Set CSRF token as a response header
  res.set('X-CSRF-Token', req.csrfToken());
  next();
};

// Routes that should be excluded from CSRF protection
const csrfExcludedRoutes = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh-token',
  '/api/webhook'
];

// Middleware to conditionally apply CSRF protection based on the route
const conditionalCsrfProtection = (req, res, next) => {
  // Skip CSRF for excluded routes
  if (csrfExcludedRoutes.includes(req.path)) {
    return next();
  }
  
  // Apply CSRF protection for all other routes
  return csrfProtection(req, res, next);
};

module.exports = {
  csrfProtection,
  handleCsrfError,
  attachCsrfToken,
  conditionalCsrfProtection
};