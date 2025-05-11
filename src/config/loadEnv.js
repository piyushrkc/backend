// src/config/loadEnv.js

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/**
 * Loads environment variables based on the current NODE_ENV
 * Priority:
 * 1. Process environment variables (already set)
 * 2. Environment-specific .env file (.env.development, .env.staging, .env.production)
 * 3. Default .env file
 */
function loadEnvironmentVariables() {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const envFile = `.env.${NODE_ENV}`;
  const envPath = path.resolve(process.cwd(), envFile);
  const defaultEnvPath = path.resolve(process.cwd(), '.env');
  
  console.log(`Loading environment for ${NODE_ENV} environment`);
  
  // Load environment-specific variables
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from ${envFile}`);
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    
    // Only set if not already defined in process.env
    for (const key in envConfig) {
      if (!process.env[key]) {
        process.env[key] = envConfig[key];
      }
    }
  } else {
    console.log(`Environment file ${envFile} not found.`);
  }
  
  // Load default .env as fallback
  if (fs.existsSync(defaultEnvPath)) {
    console.log(`Loading environment from .env as fallback`);
    const defaultEnvConfig = dotenv.parse(fs.readFileSync(defaultEnvPath));
    
    // Only set if not already defined in process.env or environment-specific .env
    for (const key in defaultEnvConfig) {
      if (!process.env[key]) {
        process.env[key] = defaultEnvConfig[key];
      }
    }
  } else {
    console.log(`No .env file found. Using system environment variables.`);
  }
  
  // Validate critical environment variables for production
  if (NODE_ENV === 'production') {
    // Required variables - these must exist
    const requiredVars = [
      'JWT_SECRET',
      'MONGODB_URI',
      'JWT_EXPIRES_IN',
      'JWT_REFRESH_EXPIRES_IN'
    ];
    
    // Email-related variables - only check if email service is not specified
    const emailServiceVar = process.env.EMAIL_PROVIDER || '';
    let emailVars = [];
    
    // Determine which email variables to check based on the provider
    if (emailServiceVar.toLowerCase() === 'resend') {
      emailVars = ['RESEND_API_KEY'];
    } else if (emailServiceVar.toLowerCase() === 'sendgrid') {
      emailVars = ['SENDGRID_API_KEY'];
    } else if (emailServiceVar.toLowerCase() === 'smtp') {
      emailVars = ['EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_HOST', 'EMAIL_PORT'];
    } else {
      // Default to basic email if no provider specified
      emailVars = ['EMAIL_USER', 'EMAIL_PASSWORD'];
    }
    
    // Check required variables
    const missingRequiredVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingRequiredVars.length > 0) {
      throw new Error(`Missing critical environment variables: ${missingRequiredVars.join(', ')}`);
    }
    
    // Check email variables only if email provider is specified
    if (emailServiceVar) {
      const missingEmailVars = emailVars.filter(varName => !process.env[varName]);
      if (missingEmailVars.length > 0) {
        console.warn(`WARNING: Email functionality may be limited. Missing: ${missingEmailVars.join(', ')}`);
        
        // Only throw error if email provider is specified and variables are missing
        if (emailServiceVar && missingEmailVars.length === emailVars.length) {
          throw new Error(`Email provider '${emailServiceVar}' specified but missing required variables: ${missingEmailVars.join(', ')}`);
        }
      }
    } else {
      console.warn('No email provider specified. Email functionality will be disabled.');
    }
  }
}

module.exports = loadEnvironmentVariables;