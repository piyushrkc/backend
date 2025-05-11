// src/utils/logger.js
const winston = require('winston');
const path = require('path');
const config = require('../config/config');

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
  const env = config.app.env || 'development';
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

// Define the format for file output (JSON for easier parsing)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.json(),
);

// Define log directory
const logDir = path.join(process.cwd(), 'logs');

// Create a custom format for handling Error objects
const errorFormat = winston.format((info) => {
  if (info.error instanceof Error) {
    info.message = `${info.message} ${info.error.stack}`;
    delete info.error;
  }
  return info;
});

// Define transports
const transports = [
  // Console transport for all environments
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Add file transports for non-test environments
if (config.app.env !== 'test') {
  transports.push(
    // Write errors to a separate file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write all logs to a combined file
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  );
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format: winston.format.combine(
    errorFormat(),
    winston.format.metadata(),
    winston.format.json(),
  ),
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

module.exports = logger;