// src/services/twilioService.js
const twilio = require('twilio');
const config = require('../config/config');
const logger = require('../utils/logger');

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

let twilioClient;
try {
  twilioClient = twilio(accountSid, authToken);
  logger.info('Twilio client initialized');
} catch (error) {
  logger.error('Error initializing Twilio client:', error);
}

/**
 * Generate an access token for a Twilio Video room
 * @param {string} identity - The identity of the participant (userId)
 * @param {string} roomName - The name of the room to connect to
 * @param {boolean} isDoctor - Whether the user is a doctor or patient
 * @returns {string} - The access token
 */
const generateToken = (identity, roomName, isDoctor = false) => {
  try {
    // Validate required parameters
    if (!identity || !roomName) {
      throw new Error('Identity and room name are required');
    }

    // Create an access token
    const { AccessToken } = twilio.jwt;
    const { VideoGrant } = AccessToken;

    // Create a video grant for this specific room
    const videoGrant = new VideoGrant({
      room: roomName
    });

    // Create an access token
    const token = new AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: identity }
    );

    // Add the video grant to the token
    token.addGrant(videoGrant);

    // Set token expiration - longer for doctors, shorter for patients
    // This helps prevent unauthorized access
    const ttl = isDoctor ? 24 * 3600 : 4 * 3600; // 24 hours for doctors, 4 hours for patients
    token.ttl = ttl;

    // Return the token as a string
    return token.toJwt();
  } catch (error) {
    logger.error('Error generating Twilio token:', error);
    throw error;
  }
};

/**
 * Create a new Twilio Video room
 * @param {string} roomName - Unique name for the room
 * @param {boolean} enableRecording - Whether to enable recording
 * @returns {Promise<object>} - Room details
 */
const createRoom = async (roomName, enableRecording = false) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    // Check if room already exists
    try {
      const existingRoom = await twilioClient.video.v1.rooms(roomName).fetch();
      
      // If room exists and is in-progress, return it
      if (existingRoom.status === 'in-progress') {
        logger.info(`Room ${roomName} already exists and is in-progress`);
        return existingRoom;
      }
      
      // If room exists but is completed, we'll create a new one with the same name
      logger.info(`Room ${roomName} exists but is ${existingRoom.status}, creating new room`);
    } catch (error) {
      // Room doesn't exist, which is fine - we'll create it
      if (error.code !== 20404) {
        // If error is not "room not found", rethrow it
        throw error;
      }
    }
    
    // Set recording options if enabled
    const recordingRules = enableRecording ? {
      type: 'group',
      rules: [{
        type: 'include',
        all: true
      }]
    } : null;

    // Create the room
    const room = await twilioClient.video.v1.rooms.create({
      uniqueName: roomName,
      type: 'group', // group for multiparty rooms
      recordParticipantsOnConnect: enableRecording,
      statusCallback: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/telemedicine/room-status-callback`,
      statusCallbackMethod: 'POST',
      emptyRoomTimeout: 5, // close the room after 5 minutes of inactivity
      mediaRegion: 'in1', // India region for better performance
      recordingRules: recordingRules ? JSON.stringify(recordingRules) : undefined
    });
    
    logger.info(`Created Twilio Video room: ${roomName}`);
    return room;
  } catch (error) {
    logger.error('Error creating Twilio Video room:', error);
    throw error;
  }
};

/**
 * End a Twilio Video room
 * @param {string} roomSid - The SID of the room to end
 * @returns {Promise<object>} - Updated room details
 */
const endRoom = async (roomSid) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const room = await twilioClient.video.v1.rooms(roomSid).update({
      status: 'completed'
    });
    
    logger.info(`Ended Twilio Video room: ${roomSid}`);
    return room;
  } catch (error) {
    logger.error(`Error ending Twilio Video room ${roomSid}:`, error);
    throw error;
  }
};

/**
 * Get a list of recordings for a specific room
 * @param {string} roomSid - The SID of the room
 * @returns {Promise<array>} - List of recordings
 */
const getRoomRecordings = async (roomSid) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const recordings = await twilioClient.video.v1.recordings
      .list({ groupingSid: roomSid });
    
    return recordings;
  } catch (error) {
    logger.error(`Error fetching recordings for room ${roomSid}:`, error);
    throw error;
  }
};

/**
 * Get a room by SID or name
 * @param {string} roomIdentifier - The SID or name of the room
 * @returns {Promise<object>} - Room details
 */
const getRoom = async (roomIdentifier) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    const room = await twilioClient.video.v1.rooms(roomIdentifier).fetch();
    return room;
  } catch (error) {
    // If room doesn't exist, return null instead of throwing
    if (error.code === 20404) {
      return null;
    }
    logger.error(`Error fetching room ${roomIdentifier}:`, error);
    throw error;
  }
};

module.exports = {
  generateToken,
  createRoom,
  endRoom,
  getRoomRecordings,
  getRoom,
  twilioClient
};