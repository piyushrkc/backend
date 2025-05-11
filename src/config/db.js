// src/config/db.js
const mongoose = require('mongoose');
const config = require('./config');

// Function to properly encode MongoDB URI
const encodeMongoURI = (uri) => {
  try {
    // Check if URI is already valid
    new URL(uri);
    return uri;
  } catch (error) {
    // URI is not valid, attempt to fix it

    // Basic pattern for MongoDB connection string
    const pattern = /^mongodb(\+srv)?:\/\/([^:]+):([^@]+)@([^/]+)\/(.*)$/;
    const match = uri.match(pattern);

    if (match) {
      const [, srv, username, password, host, database] = match;
      // Encode username and password
      const encodedUsername = encodeURIComponent(username);
      const encodedPassword = encodeURIComponent(password);

      // Reconstruct the URI with encoded components
      return `mongodb${srv || ''}://${encodedUsername}:${encodedPassword}@${host}/${database}`;
    }

    // If we can't parse it, return the original URI
    console.warn('Could not parse MongoDB URI for encoding. Using as-is.');
    return uri;
  }
};

const connectDB = async () => {
  try {
    // Check for MongoDB URI environment variable
    if (!config.db.uri || config.db.uri.includes('placeholder')) {
      if (process.env.VERCEL) {
        console.error('Missing MongoDB URI in Vercel environment');
        console.log('Application will continue with limited functionality');
        return null;
      } else {
        throw new Error('MongoDB URI is required');
      }
    }

    // Properly encode the MongoDB URI
    const encodedURI = encodeMongoURI(config.db.uri);

    console.log(`Connecting to MongoDB (URI has ${encodedURI.length} characters)...`);

    // Add connection options for better reliability
    const conn = await mongoose.connect(encodedURI, {
      // Mongoose 6+ defaults already include these settings
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Listen for connection errors after initial connection
    mongoose.connection.on('error', err => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);

    // On Vercel, don't exit the process, just return null
    if (process.env.VERCEL) {
      console.error('Application will continue with limited functionality');
      return null;
    } else {
      process.exit(1);
    }
  }
};

module.exports = connectDB;