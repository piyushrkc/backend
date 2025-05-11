// src/middleware/metrics.js
const promBundle = require('express-prom-bundle');
const client = require('prom-client');
const logger = require('../utils/logger');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add a default label to all metrics
client.register.setDefaultLabels({
  app: 'hospital-management-system'
});

// Initialize metrics collection
client.collectDefaultMetrics({ register });

// Create custom metrics
const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
});

const httpRequestSizeBytesHistogram = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
});

const httpResponseSizeBytesHistogram = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
});

const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections'
});

const databaseOperationDurationHistogram = new client.Histogram({
  name: 'db_operation_duration_ms',
  help: 'Duration of database operations in ms',
  labelNames: ['operation', 'collection'],
  buckets: [1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000]
});

// Register the metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestSizeBytesHistogram);
register.registerMetric(httpResponseSizeBytesHistogram);
register.registerMetric(activeConnections);
register.registerMetric(databaseOperationDurationHistogram);

// Create the middleware
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  promClient: { register },
  promRegistry: register,
  // Exclude certain paths from metrics
  excludePath: ['/metrics', '/api/health', '/api/health/detailed', '/favicon.ico', '/static'],
  // Custom normalization of URL paths
  normalizePath: (req) => {
    // Convert dynamic route parameters to fixed path patterns
    let path = req.originalUrl.split('?')[0];
    
    // Replace numeric IDs with :id
    path = path.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id');
    
    return path;
  },
  metricsPath: '/metrics',
  // Authentication middleware to protect metrics endpoint
  authenticate: (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (process.env.METRICS_API_KEY && apiKey === process.env.METRICS_API_KEY) {
      next();
    } else {
      logger.warn('Unauthorized metrics access attempt', {
        ip: req.ip,
        headers: req.headers
      });
      res.status(403).send('Unauthorized');
    }
  }
});

// Create a middleware to track active connections
const connectionTracker = (req, res, next) => {
  activeConnections.inc();
  
  res.on('finish', () => {
    activeConnections.dec();
  });
  
  next();
};

// Create a function to track database operations
const trackDbOperation = (operation, collection, startTime) => {
  const duration = Date.now() - startTime;
  databaseOperationDurationHistogram.observe({ operation, collection }, duration);
};

module.exports = {
  metricsMiddleware,
  connectionTracker,
  register,
  trackDbOperation
};