// src/services/notificationService.js

const config = require('../config/config');
const logger = require('../utils/logger');
const emailService = require('./emailService');

/**
 * Notification Service
 * Handles sending notifications through various channels (email, SMS)
 */
class NotificationService {
  constructor() {
    // Initialize SMS provider (e.g., Twilio)
    if (config.sms.provider === 'twilio') {
      this.smsClient = require('twilio')(
        config.sms.accountSid,
        config.sms.authToken
      );
    }
  }

  /**
   * Send email notification
   * @param {Object} options - Email options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Plain text content
   * @param {string} options.html - HTML content (optional)
   * @returns {Promise} - Promise resolving to sent message info
   */
  async sendEmail(options) {
    try {
      // Use the specialized email service to send emails
      const result = await emailService.sendEmail(options);
      logger.info('Email sent through notification service', { 
        to: options.to, 
        subject: options.subject
      });
      return result;
    } catch (error) {
      logger.error('Error sending email through notification service', { 
        error: error.message,
        to: options.to,
        subject: options.subject
      });
      throw error;
    }
  }

  /**
   * Send SMS notification
   * @param {Object} options - SMS options
   * @param {string} options.to - Recipient phone number
   * @param {string} options.body - SMS content
   * @returns {Promise} - Promise resolving to sent message info
   */
  async sendSMS({ to, body }) {
    try {
      if (!this.smsClient) {
        throw new Error('SMS provider not configured');
      }

      const message = await this.smsClient.messages.create({
        body,
        messagingServiceSid: config.sms.messagingServiceSid,
        to
      });
      
      console.log('SMS sent:', message.sid);
      return message;
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Send appointment reminder
   * @param {Object} appointment - Appointment details
   * @param {Object} patient - Patient details
   * @param {Object} doctor - Doctor details
   * @param {string} channel - Notification channel ('email', 'sms', 'both')
   * @returns {Promise} - Promise resolving to sent notification info
   */
  async sendAppointmentReminder(appointment, patient, doctor, channel = 'both') {
    const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString();
    const appointmentTime = appointment.appointmentTime;
    
    const result = {};
    
    if (channel === 'email' || channel === 'both') {
      const emailSubject = 'Appointment Reminder';
      const emailText = `
        Dear ${patient.firstName} ${patient.lastName},
        
        This is a reminder of your appointment with Dr. ${doctor.firstName} ${doctor.lastName} on ${appointmentDate} at ${appointmentTime}.
        
        Please arrive 15 minutes before your scheduled time.
        
        If you need to reschedule, please contact us at least 24 hours in advance.
        
        Thank you,
        Hospital Management System
      `;
      
      if (patient.email) {
        result.email = await this.sendEmail({
          to: patient.email,
          subject: emailSubject,
          text: emailText
        });
      }
    }
    
    if (channel === 'sms' || channel === 'both') {
      const smsText = `Reminder: You have an appointment with Dr. ${doctor.lastName} on ${appointmentDate} at ${appointmentTime}. Please arrive 15 minutes early.`;
      
      if (patient.phoneNumber) {
        result.sms = await this.sendSMS({
          to: patient.phoneNumber,
          body: smsText
        });
      }
    }
    
    return result;
  }
  
  /**
   * Send lab result notification
   * @param {Object} labTest - Lab test details
   * @param {Object} patient - Patient details
   * @param {Object} result - Test result details
   * @param {string} channel - Notification channel ('email', 'sms', 'both')
   * @returns {Promise} - Promise resolving to sent notification info
   */
  async sendLabResultNotification(labTest, patient, result, channel = 'both') {
    const outcome = {};
    
    if (channel === 'email' || channel === 'both') {
      const emailSubject = `Lab Results Available: ${labTest.testType}`;
      const emailText = `
        Dear ${patient.firstName} ${patient.lastName},
        
        Your lab test results for ${labTest.testType} are now available.
        
        Please log in to your patient portal to view the complete results or contact your doctor.
        
        Thank you,
        Hospital Management System
      `;
      
      if (patient.email) {
        outcome.email = await this.sendEmail({
          to: patient.email,
          subject: emailSubject,
          text: emailText
        });
      }
    }
    
    if (channel === 'sms' || channel === 'both') {
      const smsText = `Your lab results for ${labTest.testType} are now available. Please log in to your patient portal or contact your doctor.`;
      
      if (patient.phoneNumber) {
        outcome.sms = await this.sendSMS({
          to: patient.phoneNumber,
          body: smsText
        });
      }
    }
    
    return outcome;
  }
  
  /**
   * Send medication reminder
   * @param {Object} medication - Medication details
   * @param {Object} patient - Patient details
   * @param {string} dosage - Dosage information
   * @param {string} time - Time to take medication
   * @param {string} channel - Notification channel ('email', 'sms', 'both')
   * @returns {Promise} - Promise resolving to sent notification info
   */
  async sendMedicationReminder(medication, patient, dosage, time, channel = 'sms') {
    const outcome = {};
    
    if (channel === 'email' || channel === 'both') {
      const emailSubject = 'Medication Reminder';
      const emailText = `
        Dear ${patient.firstName} ${patient.lastName},
        
        This is a reminder to take your medication: ${medication.name} ${dosage}.
        
        Scheduled time: ${time}
        
        Please follow your doctor's instructions regarding this medication.
        
        Thank you,
        Hospital Management System
      `;
      
      if (patient.email) {
        outcome.email = await this.sendEmail({
          to: patient.email,
          subject: emailSubject,
          text: emailText
        });
      }
    }
    
    if (channel === 'sms' || channel === 'both') {
      const smsText = `Medication Reminder: It's time to take ${medication.name} ${dosage}. Scheduled for ${time}.`;
      
      if (patient.phoneNumber) {
        outcome.sms = await this.sendSMS({
          to: patient.phoneNumber,
          body: smsText
        });
      }
    }
    
    return outcome;
  }
  
  /**
   * Send system notification to multiple users
   * @param {Array} users - Array of user objects
   * @param {string} title - Notification title
   * @param {string} content - Notification content
   * @param {string} channel - Notification channel ('email', 'sms', 'both')
   * @returns {Promise} - Promise resolving to array of sent notification info
   */
  async sendSystemNotification(users, title, content, channel = 'email') {
    const results = [];
    
    for (const user of users) {
      try {
        const result = {};
        
        if ((channel === 'email' || channel === 'both') && user.email) {
          result.email = await this.sendEmail({
            to: user.email,
            subject: title,
            text: content
          });
        }
        
        if ((channel === 'sms' || channel === 'both') && user.phoneNumber) {
          result.sms = await this.sendSMS({
            to: user.phoneNumber,
            body: `${title}: ${content}`
          });
        }
        
        results.push({
          userId: user._id,
          result
        });
      } catch (error) {
        console.error(`Error sending notification to user ${user._id}:`, error);
        results.push({
          userId: user._id,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new NotificationService();