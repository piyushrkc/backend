// src/controllers/healthController.js
const mongoose = require('mongoose');
const config = require('../config/config');
const os = require('os');
const { register } = require('../middleware/metrics');
const logger = require('../utils/logger');

/**
 * Simple health check endpoint
 * Returns basic service status
 * Used by load balancers and monitoring systems
 */
exports.healthCheck = async (req, res) => {
  try {
    // Check database connection (primary dependency)
    const dbState = mongoose.connection.readyState;
    const isHealthy = dbState === 1;
    
    const healthcheck = {
      status: isHealthy ? 'success' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now(),
      service: 'Hospital Management System API',
      environment: config.app.env
    };
    
    res.status(isHealthy ? 200 : 503).json(healthcheck);
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
};

/**
 * Detailed health check endpoint
 * Checks database connection and other services
 * Requires authentication to access
 */
exports.detailedHealthCheck = async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Get system load averages (1, 5, and 15 minutes)
    const loadAvg = os.loadavg();
    
    // Get CPU information
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // Get memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // Get process memory usage
    const memoryUsage = process.memoryUsage();
    
    // Get network interfaces (excluding internal and loopback)
    const networkInterfaces = Object.entries(os.networkInterfaces())
      .reduce((acc, [name, interfaces]) => {
        const validInterfaces = interfaces.filter(iface => 
          !iface.internal && iface.family === 'IPv4'
        );
        if (validInterfaces.length > 0) {
          acc[name] = validInterfaces;
        }
        return acc;
      }, {});
    
    // Get uptime
    const uptime = {
      system: os.uptime(),
      process: process.uptime(),
      formatted: {
        system: formatUptime(os.uptime()),
        process: formatUptime(process.uptime())
      }
    };
    
    // System information
    const healthcheck = {
      status: dbState === 1 ? 'success' : 'warning',
      timestamp: Date.now(),
      uptime,
      service: 'Hospital Management System API',
      environment: config.app.env,
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        ppid: process.ppid,
        argv: process.argv,
        execPath: process.execPath,
      },
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch(),
        cpus: {
          count: cpuCount,
          model: cpus[0]?.model || 'unknown',
          speed: cpus[0]?.speed || 0,
        },
        loadAvg,
        loadPerCpu: loadAvg.map(load => (load / cpuCount).toFixed(2)),
        memory: {
          total: formatBytes(totalMemory),
          free: formatBytes(freeMemory),
          used: formatBytes(usedMemory),
          percentUsed: ((usedMemory / totalMemory) * 100).toFixed(2) + '%',
        },
        network: networkInterfaces,
      },
      process: {
        memory: {
          rss: formatBytes(memoryUsage.rss),
          heapTotal: formatBytes(memoryUsage.heapTotal),
          heapUsed: formatBytes(memoryUsage.heapUsed),
          external: formatBytes(memoryUsage.external),
          arrayBuffers: memoryUsage.arrayBuffers ? formatBytes(memoryUsage.arrayBuffers) : 'N/A',
          percentHeapUsed: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2) + '%',
        },
      },
      database: {
        status: dbStatus[dbState],
        state: dbState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        collections: Object.keys(mongoose.connection.collections).length,
        models: Object.keys(mongoose.models).length,
      },
      dependencies: {
        mongoose: require('mongoose/package.json').version,
        express: require('express/package.json').version,
        winston: require('winston/package.json').version,
        node: process.version
      }
    };
    
    // Add metrics count if available
    try {
      const metrics = await register.getMetricsAsJSON();
      healthcheck.metrics = {
        count: metrics.length,
        names: metrics.map(m => m.name),
      };
    } catch (err) {
      healthcheck.metrics = { error: 'Failed to get metrics' };
    }
    
    // Determine overall status
    if (dbState !== 1) {
      healthcheck.status = 'warning';
    }
    
    res.status(200).json(healthcheck);
  } catch (error) {
    logger.error('Detailed health check failed', { error });
    res.status(500).json({ 
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
};

/**
 * Readiness check endpoint
 * Verifies if the application is ready to accept traffic
 */
exports.readinessCheck = async (req, res) => {
  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    
    // System is ready if database is connected
    if (dbState === 1) {
      return res.status(200).json({
        status: 'success',
        message: 'Service is ready to accept traffic',
        timestamp: Date.now()
      });
    }
    
    // If database is not connected, service is not ready
    res.status(503).json({
      status: 'error',
      message: 'Service is not ready to accept traffic',
      reason: 'Database connection is not established',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Readiness check failed', { error });
    res.status(500).json({ 
      status: 'error',
      message: 'Readiness check failed',
      error: error.message,
      timestamp: Date.now()
    });
  }
};

/**
 * Liveness check endpoint
 * Verifies if the application is running
 */
exports.livenessCheck = async (req, res) => {
  // If this endpoint responds, the application is considered alive
  res.status(200).json({
    status: 'success',
    message: 'Service is alive',
    uptime: Math.floor(process.uptime()),
    timestamp: Date.now()
  });
};

/**
 * Format bytes to a human-readable format
 * @param {number} bytes - The number of bytes
 * @returns {string} - Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format uptime to a human-readable format
 * @param {number} uptime - Uptime in seconds
 * @returns {string} - Formatted string
 */
function formatUptime(uptime) {
  let uptimeStr = '';
  
  // Calculate days, hours, minutes, and seconds
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);
  
  if (days > 0) uptimeStr += `${days}d `;
  if (hours > 0 || days > 0) uptimeStr += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) uptimeStr += `${minutes}m `;
  uptimeStr += `${seconds}s`;
  
  return uptimeStr;
}