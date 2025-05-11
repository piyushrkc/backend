/**
 * Production configuration for the Hospital Management System backend
 */
require('dotenv').config();

module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 8000,
    environment: 'production',
    corsOrigin: process.env.CORS_ORIGIN || 'https://your-hospital-domain.com',
  },
  
  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    },
  },
  
  // JWT Authentication
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    from: 'notifications@your-hospital-domain.com',
    resendApiKey: process.env.RESEND_API_KEY,
  },
  
  // Telemedicine Configuration
  telemedicine: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioApiKey: process.env.TWILIO_API_KEY,
    twilioApiSecret: process.env.TWILIO_API_SECRET,
  },
  
  // Cache Configuration
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
    redisUrl: process.env.REDIS_URL,
    ttl: 3600, // 1 hour in seconds
  },
  
  // Security Configuration
  security: {
    rateLimiter: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "wss://*.twilio.com", "https://*.twilio.com"],
          mediaSrc: ["'self'", "blob:", "data:"],
          imgSrc: ["'self'", "blob:", "data:"],
        },
      },
    },
  },
  
  // Logging Configuration
  logging: {
    level: 'info',
    format: 'json', // Use JSON format for production logs
  },
};