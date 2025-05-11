// src/middleware/errorHandler.js
const logger = require('../utils/logger');
const config = require('../config/config');
const mongoose = require('mongoose');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = {}) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to access this resource') {
    super(message, 403);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

// Handle known errors with appropriate status codes
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.keyValue ? Object.values(err.keyValue)[0] : '';
  const message = `Duplicate field value: ${value}. Please use another value.`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new ValidationError(message, err.errors);
};

const handleJWTError = () => new AuthenticationError('Invalid token. Please log in again.');

const handleJWTExpiredError = () => new AuthenticationError('Your token has expired. Please log in again.');

const handleCSRFError = () => new AppError('Invalid CSRF token. Please try again.', 403);

// Send error response in development
const sendErrorDev = (err, res) => {
  return res.status(err.statusCode || 500).json({
    success: false,
    status: err.status,
    message: err.message,
    error: err,
    stack: err.stack
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode || 500).json({
      success: false,
      status: err.status,
      message: err.message,
      ...(err.errors && { errors: err.errors })
    });
  }
  
  // Programming or other unknown error: don't leak error details
  // Log the error for internal debugging
  logger.error('Unexpected error', { error: err });
  
  // Send generic message to client
  return res.status(500).json({
    success: false,
    status: 'error',
    message: 'Something went wrong'
  });
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  
  // Log all errors (structured format)
  logger.error(err.message, {
    error: err,
    requestId: req.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
    user: req.user ? req.user.userId : 'unauthenticated'
  });
  
  // Different error handling based on environment
  if (config.app.env === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    
    // Handle specific error types
    if (error.name === 'CastError' || err instanceof mongoose.Error.CastError) error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError' || err instanceof mongoose.Error.ValidationError) error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.code === 'EBADCSRFTOKEN') error = handleCSRFError();
    
    sendErrorProd(error, res);
  }
};

// Route not found handler
const notFoundHandler = (req, res, next) => {
  next(new NotFoundError(`Cannot find ${req.method} ${req.originalUrl} on this server`));
};

module.exports = {
  errorHandler,
  notFoundHandler,
  AppError,
  NotFoundError,
  ValidationError,
  AuthorizationError,
  AuthenticationError
};