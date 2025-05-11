/**
 * Error handling utility functions
 * Used to handle and standardize error responses
 */

const logger = require('./logger');

// Standard error class for API errors
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Catch async errors in route handlers
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      logger.error('Caught async error', { error: err.message, path: req.path });
      next(err);
    });
  };
};

// Handle database operation errors
const handleDBError = (err) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    return new ApiError(400, `Invalid input data: ${errors.join('. ')}`);
  }
  
  if (err.name === 'CastError') {
    return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
  }
  
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new ApiError(409, `Duplicate field value: ${field}. Please use another value.`);
  }
  
  return new ApiError(500, 'Database operation failed');
};

// Send error responses based on environment
const sendErrorResponse = (err, req, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
  
  // Programming or unknown error: don't leak error details
  logger.error('Unexpected error', { error: err });
  
  return res.status(500).json({
    success: false,
    status: 'error',
    message: process.env.NODE_ENV === 'development' 
      ? err.message
      : 'Something went wrong. Please try again later.'
  });
};

module.exports = {
  ApiError,
  catchAsync,
  handleDBError,
  sendErrorResponse
};