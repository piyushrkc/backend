// src/tests/setup.js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const config = require('../config/config');

let mongoServer;

// Setup function - runs before all tests
beforeAll(async () => {
  // Create an in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  console.log(`MongoDB Memory Server started at ${mongoUri}`);
});

// Cleanup function - runs after all tests
afterAll(async () => {
  // Disconnect from the database
  await mongoose.disconnect();
  
  // Stop the in-memory MongoDB server
  await mongoServer.stop();
  
  console.log('MongoDB Memory Server stopped');
});

// Cleanup function - runs after each test
afterEach(async () => {
  // Clear all collections in the database
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});