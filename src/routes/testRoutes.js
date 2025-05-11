// src/routes/testRoutes.js
const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

// Route to test SMS sending
router.post('/sms', async (req, res) => {
  try {
    const { to, body } = req.body;
    
    if (!to || !body) {
      return res.status(400).json({
        success: false,
        message: 'Phone number (to) and message body are required'
      });
    }
    
    const result = await notificationService.sendSMS({ to, body });
    
    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS',
      error: error.message
    });
  }
});

// Route to test email sending with notification service
router.post('/email', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    
    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: 'Email address (to), subject, and text are required'
      });
    }
    
    const result = await notificationService.sendEmail({ to, subject, text, html });
    
    res.status(200).json({
      success: true,
      message: 'Email sent successfully via notification service',
      result
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// Route to test email sending with Resend directly
router.post('/email/resend', async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    
    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: 'Email address (to), subject, and text are required'
      });
    }
    
    const result = await emailService.sendEmail({ to, subject, text, html });
    
    res.status(200).json({
      success: true,
      message: 'Email sent successfully with Resend',
      result
    });
  } catch (error) {
    console.error('Error sending test email with Resend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email with Resend',
      error: error.message
    });
  }
});

// Route to test welcome email
router.post('/email/welcome', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;
    
    if (!email || !firstName) {
      return res.status(400).json({
        success: false,
        message: 'Email and firstName are required'
      });
    }
    
    const user = { email, firstName, lastName: lastName || '' };
    const result = await emailService.sendWelcomeEmail(user);
    
    res.status(200).json({
      success: true,
      message: 'Welcome email sent successfully',
      result
    });
  } catch (error) {
    console.error('Error sending welcome email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send welcome email',
      error: error.message
    });
  }
});

module.exports = router;