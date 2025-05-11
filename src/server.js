// src/server.js
// Load environment variables based on NODE_ENV
const loadEnvironmentVariables = require('./config/loadEnv');
loadEnvironmentVariables();

const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config/config');
const logger = require('./utils/logger');
const cacheService = require('./services/cacheService');
const createAdminUser = require('./scripts/createAdminUser');

// Connect to database and setup admin user
(async () => {
  try {
    await connectDB();
    logger.info('Database connected successfully');

    // Create admin user with credentials from the environment
    await createAdminUser();
    logger.info('Admin user setup complete');
  } catch (error) {
    logger.error('Error during startup:', error);
    // Continue with server startup even if admin creation fails
  }
})();

// Set port from config
const PORT = config.app.port;
const ENV = config.app.env;

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${ENV} environment on port ${PORT}`);
  
  // Log different information based on environment
  if (ENV !== 'production') {
    logger.info('Configuration loaded', {
      environment: ENV,
      database: config.db.uri.replace(/:([^:@]+)@/, ':****@'), // Hide password
      jwtExpiration: config.jwt.expiresIn,
      emailService: config.email.host,
      corsOrigin: process.env.CORS_ORIGIN,
      cacheEnabled: config.cache.enabled
    });
  }
});

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Graceful shutdown function
function gracefulShutdown() {
  logger.info('Received shutdown signal, closing server and connections...');
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close Redis connection if enabled
    if (config.cache.enabled) {
      cacheService.close();
      logger.info('Redis connection closed');
    }
    
    // Any other cleanup here
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
  
  // Force shutdown after timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown');
    process.exit(1);
  }, 10000);
}