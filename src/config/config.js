// src/config/config.js

const crypto = require('crypto');
// Note: Environment variables are now loaded by loadEnv.js before this file is required

// Generate a secure random JWT secret if not provided
// This ensures that even if JWT_SECRET is not set, a secure random value is used
// Note: In production, JWT_SECRET should be explicitly set in environment variables
const generateSecureSecret = () => {
  console.warn('WARNING: JWT_SECRET not set in environment. Using generated secret. This is not recommended for production.');
  return crypto.randomBytes(64).toString('hex');
};

// Validate that we're not using default JWT secret in production
const validateJwtSecret = (secret, env) => {
  if (env === 'production' && (!secret || secret === 'your_jwt_secret_key_change_in_production')) {
    throw new Error('JWT_SECRET must be explicitly set in production environment');
  }
  return secret || generateSecureSecret();
};

const config = {
  app: {
    port: process.env.PORT || 5000, // Explicitly use 5000
    env: process.env.NODE_ENV || 'development'
  },
  db: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital-management'
  },
  jwt: {
    secret: validateJwtSecret(process.env.JWT_SECRET, process.env.NODE_ENV),
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  email: {
    // Check if email provider is specified
    provider: process.env.EMAIL_PROVIDER || '',
    
    // SMTP configuration (if provider is smtp)
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || ''
    },
    
    // Resend configuration (if provider is resend)
    resendApiKey: process.env.RESEND_API_KEY || '',
    
    // General email settings
    from: process.env.EMAIL_FROM || 'Hospital Management <noreply@hospital.com>',
    
    // Flag to indicate if email is properly configured
    isConfigured: () => {
      const provider = process.env.EMAIL_PROVIDER || '';
      
      if (provider.toLowerCase() === 'resend') {
        return !!process.env.RESEND_API_KEY;
      } else if (provider.toLowerCase() === 'smtp') {
        return !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD && process.env.EMAIL_HOST);
      } else if (provider.toLowerCase() === 'sendgrid') {
        return !!process.env.SENDGRID_API_KEY;
      }
      
      // No valid provider configured
      return false;
    }
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || ''
  },
  security: {
    rateLimiting: {
      window: parseInt(process.env.RATE_LIMIT_WINDOW || '15'), // minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100')
    }
  },
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true' || false,
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: {
      default: parseInt(process.env.CACHE_DEFAULT_TTL || '600'), // 10 minutes
      appointments: parseInt(process.env.CACHE_APPOINTMENTS_TTL || '300'), // 5 minutes
      patients: parseInt(process.env.CACHE_PATIENTS_TTL || '900'), // 15 minutes
      doctors: parseInt(process.env.CACHE_DOCTORS_TTL || '1800') // 30 minutes
    }
  }
};

// Final validation to ensure critical production configs are set
if (config.app.env === 'production') {
  const requiredEnvVars = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables for production: ${missingVars.join(', ')}`);
  }
  
  // Log warning if email not configured
  if (!config.email.isConfigured()) {
    console.warn('WARNING: Email service is not properly configured. Email functionality will be disabled.');
  }
}

module.exports = config;