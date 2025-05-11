// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const config = require('../config/config');

/**
 * Auth rate limiter for sensitive endpoints like login, register, and password reset
 * Uses a stricter rate limit to prevent brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 429,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    error: 'RATE_LIMIT_EXCEEDED'
  },
  // Store to keep track of requests - defaults to memory but can be replaced with Redis or similar
  // for production use cases where you have multiple API servers
  // store: new RedisStore({ /* redis connection options */ })
});

/**
 * API rate limiter for general API endpoints
 * Uses a more relaxed rate limit compared to auth endpoints
 */
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimiting.window * 60 * 1000, // configured in minutes
  max: config.security.rateLimiting.max, // limit each IP to configured requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many requests. Please try again later.',
    error: 'RATE_LIMIT_EXCEEDED'
  }
});

/**
 * Rate limiter specifically for password reset/recovery to prevent abuse
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Too many password reset attempts. Please try again after 1 hour.',
    error: 'RATE_LIMIT_EXCEEDED'
  }
});

module.exports = {
  authLimiter,
  apiLimiter,
  passwordResetLimiter
};