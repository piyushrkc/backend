// src/utils/logger.js
const winston = require('winston');

// Simple console-only logger for Vercel serverless environment
// No file transports to avoid filesystem access issues

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : env === 'test' ? 'warn' : 'info';
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Define the format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Create a custom format for handling Error objects
const errorFormat = winston.format((info) => {
  if (info.error instanceof Error) {
    info.message = `${info.message} ${info.error.stack}`;
    delete info.error;
  }
  return info;
});

// Create the logger with ONLY console transport
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    errorFormat(),
    winston.format.metadata(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    })
  ],
  exitOnError: false,
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;