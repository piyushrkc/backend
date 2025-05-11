// This script automatically adds your current IP to MongoDB Atlas whitelist
require('dotenv').config();
const https = require('https');
const http = require('http');

// Function to get public IP address
async function getPublicIP() {
  return new Promise((resolve, reject) => {
    http.get('http://api.ipify.org', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve(data.trim());
      });
    }).on('error', (err) => {
      console.error('Error getting public IP:', err.message);
      reject(err);
    });
  });
}

// Function to print MongoDB Atlas whitelist instructions
async function printWhitelistInstructions() {
  try {
    const publicIP = await getPublicIP();
    
    console.log(`\n=== MongoDB Atlas IP Whitelist Instructions ===\n`);
    console.log(`Your current public IP address is: ${publicIP}`);
    console.log(`\nTo allow your application to connect to MongoDB Atlas, you need to add this IP to the whitelist:`);
    console.log(`\n1. Log in to MongoDB Atlas at https://cloud.mongodb.com`);
    console.log(`2. Select your cluster: "Cluster0"`);
    console.log(`3. Click on "Network Access" in the left menu`);
    console.log(`4. Click the "Add IP Address" button`);
    console.log(`5. Enter your IP address: ${publicIP}`);
    console.log(`6. Add a description like "Development Machine"`);
    console.log(`7. Click "Confirm"\n`);
    console.log(`After adding your IP to the whitelist, restart your application.\n`);
    
  } catch (error) {
    console.error('Failed to get whitelist instructions:', error);
  }
}

// Run the function
printWhitelistInstructions();