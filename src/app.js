// src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const logger = require('./utils/logger');
const { requestLogger, requestId } = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { conditionalCsrfProtection, handleCsrfError } = require('./middleware/csrf');
const { metricsMiddleware, connectionTracker } = require('./middleware/metrics');
const cacheService = require('./services/cacheService');
const indexRoutes = require('./routes/indexRoutes');

const app = express();

// Add request ID to each request
app.use(requestId);

// Trust proxy - needed for rate limiting by IP behind reverse proxies
app.set('trust proxy', 1);

// Apply security headers
app.use(helmet());

// Configure CORS with credentials support
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // Allow cookies to be sent with requests
  exposedHeaders: ['X-Request-ID'] // Expose request ID header
}));

// Parse request bodies and cookies
app.use(express.json({
  limit: '1mb', // Limit JSON payload size
  verify: (req, res, buf) => { req.rawBody = buf.toString(); } // Keep raw body for CSRF validation
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Add connection tracking
app.use(connectionTracker);

// Add request logging with Morgan
app.use(requestLogger);

// Add Prometheus metrics
app.use(metricsMiddleware);

// Apply CSRF protection
app.use(conditionalCsrfProtection);
app.use(handleCsrfError);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Hospital Management System API',
    version: process.env.npm_package_version || '1.0.0',
    environment: config.app.env,
    docs: '/api/docs'
  });
});

// API routes
app.use('/api', indexRoutes);

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Centralized error handling - must be the last middleware
app.use(errorHandler);

// Unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error });
  
  // Give the logger time to flush, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

module.exports = app;