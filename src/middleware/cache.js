const cacheService = require('../services/cacheService');
const logger = require('../utils/logger');

/**
 * Cache middleware for API responses
 * @param {Number} ttl - Time to live in seconds
 * @returns {Function} Express middleware
 */
const cacheMiddleware = (ttl) => {
  return async (req, res, next) => {
    // Skip cache for non-GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key based on request
    const key = cacheService.generateKey(req);

    try {
      // Try to get data from cache
      const cachedData = await cacheService.get(key);
      
      if (cachedData) {
        // Return cached data
        logger.debug('Cache hit', { key });
        
        // Set cache header
        res.set('X-Cache', 'HIT');
        
        return res.status(200).json(cachedData);
      }

      // Cache miss - continue to handler
      logger.debug('Cache miss', { key });
      res.set('X-Cache', 'MISS');

      // Store original json method
      const originalJson = res.json;

      // Override res.json method to cache response
      res.json = function (data) {
        // Restore original json method
        res.json = originalJson;

        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(key, data, ttl);
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      // If cache error, continue without caching
      logger.error('Cache middleware error', { error: error.message });
      next();
    }
  };
};

/**
 * Cache invalidation middleware - clears cache when data changes
 * @param {String} pattern - Cache key pattern to clear
 * @returns {Function} Express middleware
 */
const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    // Store original end method
    const originalEnd = res.end;

    // Override end method
    res.end = async function (chunk, encoding) {
      // Clear cache only for successful modifying operations
      if (res.statusCode >= 200 && res.statusCode < 300 &&
         ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        
        try {
          const clearedCount = await cacheService.clearPattern(pattern);
          logger.debug('Cache invalidated', { pattern, count: clearedCount });
        } catch (error) {
          logger.error('Cache invalidation error', { pattern, error: error.message });
        }
      }
      
      // Call original end method
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

module.exports = {
  cache: cacheMiddleware,
  invalidateCache
};