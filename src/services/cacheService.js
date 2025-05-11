const redis = require('redis');
const { promisify } = require('util');
const logger = require('../utils/logger');
const config = require('../config/config');

// Default TTL in seconds (10 minutes)
const DEFAULT_TTL = 600;

class CacheService {
  constructor() {
    this.isConnected = false;
    this.client = null;
    this.connect();
  }

  async connect() {
    try {
      // Get Redis URL from config
      const redisUrl = config.cache?.REDIS_URL || 'redis://localhost:6379';
      
      // Create Redis client (Redis 5.0.0+ uses different API)
      this.client = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis max retry attempts reached', { attempts: retries });
              return new Error('Max retry attempts reached');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Set up event listeners before connecting
      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis client connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        logger.error('Redis client error', { error: err.message });
      });

      this.client.on('end', () => {
        this.isConnected = false;
        logger.info('Redis client disconnected');
      });

      // Connect to Redis server
      await this.client.connect();
      
    } catch (error) {
      logger.error('Error initializing Redis client', { error: error.message });
      this.isConnected = false;
    }
  }

  /**
   * Generate a cache key from the request
   * @param {Object} req - Express request object
   * @returns {String} Cache key
   */
  generateKey(req) {
    const path = req.originalUrl || req.url;
    const method = req.method;
    const userId = req.user ? req.user.id : 'anonymous';
    
    // For GET requests, include query params in key
    // For POST/PUT/PATCH, include body data hash
    const key = `${method}:${path}:${userId}`;
    return key;
  }

  /**
   * Get data from cache
   * @param {String} key - Cache key
   * @returns {Promise<Object|null>} Cached data or null
   */
  async get(key) {
    if (!this.isConnected || !this.client) return null;
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set data in cache
   * @param {String} key - Cache key
   * @param {Object} data - Data to cache
   * @param {Number} ttl - Time to live in seconds (optional)
   * @returns {Promise<Boolean>} Success flag
   */
  async set(key, data, ttl = DEFAULT_TTL) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      const serialized = JSON.stringify(data);
      await this.client.setEx(key, ttl, serialized);
      return true;
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Delete data from cache
   * @param {String} key - Cache key
   * @returns {Promise<Boolean>} Success flag
   */
  async del(key) {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  /**
   * Clear all cache
   * @returns {Promise<Boolean>} Success flag
   */
  async flush() {
    if (!this.isConnected || !this.client) return false;
    
    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      logger.error('Cache flush error', { error: error.message });
      return false;
    }
  }

  /**
   * Clear cache by pattern
   * @param {String} pattern - Key pattern to clear
   * @returns {Promise<Number>} Number of keys deleted
   */
  async clearPattern(pattern) {
    if (!this.isConnected || !this.client) return 0;
    
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      await this.client.del(keys);
      return keys.length;
    } catch (error) {
      logger.error('Cache clear pattern error', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;