// src/routes/healthRoutes.js
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { authenticate } = require('../middleware/auth');
const { register } = require('../middleware/metrics');

// Public health check route - for load balancers, Docker, etc.
router.get('/', healthController.healthCheck);

// Kubernetes readiness probe endpoint
router.get('/ready', healthController.readinessCheck);

// Kubernetes liveness probe endpoint
router.get('/live', healthController.livenessCheck);

// Detailed health check route - requires authentication
router.get('/detailed', authenticate, healthController.detailedHealthCheck);

// Prometheus metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (err) {
    res.status(500).send(`Error collecting metrics: ${err.message}`);
  }
});

module.exports = router;