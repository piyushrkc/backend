// src/middleware/requestLogger.js
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const config = require('../config/config');

// Create a request ID generator middleware
const requestId = (req, res, next) => {
  req.id = uuidv4();
  res.set('X-Request-ID', req.id);
  next();
};

// Define a custom Morgan token for request ID
morgan.token('id', (req) => req.id);

// Define a custom Morgan token for user ID (if authenticated)
morgan.token('user', (req) => (req.user ? req.user.userId : 'anonymous'));

// Define a custom Morgan token for hospital ID (if available)
morgan.token('hospital', (req) => (req.user ? req.user.hospitalId : 'unknown'));

// Define a custom Morgan token for request body (safe version)
morgan.token('body', (req) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    // Create a sanitized copy without sensitive fields
    const sanitized = { ...req.body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'authorization', 'creditCard', 'secret'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) sanitized[field] = '[REDACTED]';
    });
    
    return JSON.stringify(sanitized);
  }
  return '';
});

// Define the format based on environment
const getFormat = () => {
  if (config.app.env === 'development') {
    return ':id :method :url :status :response-time ms - :res[content-length] - :user';
  }
  
  // More detailed logging for production
  return ':id :remote-addr - :user [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :hospital';
};

// Create Morgan middleware that uses Winston as the stream
const requestLogger = morgan(getFormat(), {
  stream: logger.stream,
  // Skip logging for static assets and health checks in production
  skip: (req, res) => {
    if (config.app.env === 'production') {
      // Skip static assets and health check routes
      return req.originalUrl.startsWith('/static') || req.originalUrl === '/api/health';
    }
    return false;
  },
});

module.exports = { requestLogger, requestId };