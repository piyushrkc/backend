# Hospital Management System Backend

Backend API for the Hospital Management System with telemedicine support.

## Vercel Deployment

This repository is configured for easy deployment to Vercel.

### Deployment Steps

1. Create a new project in Vercel and connect it to this Git repository
2. Configure environment variables in Vercel (not in vercel.json):
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `JWT_SECRET`: Your secure JWT secret key
   - `JWT_EXPIRES_IN`: `30m`
   - `JWT_REFRESH_EXPIRES_IN`: `7d`
   - `CORS_ORIGIN`: Frontend URL (e.g., `https://hospital-management-frontend.vercel.app`)
   - Add Twilio credentials for telemedicine
3. Deploy the project

> **IMPORTANT SECURITY NOTE**: Never commit sensitive information like MongoDB connection strings, API keys, or JWT secrets to your repository. Always use Vercel's environment variables feature to securely store these values.

### Local Development

1. Clone this repository
2. Run `npm install`
3. Create a `.env` file with the required environment variables
4. Run `npm run dev` to start the development server

## API Documentation

The API includes endpoints for:
- User authentication
- Patient management
- Doctor management
- Appointment scheduling
- Telemedicine sessions
- Pharmacy management
- Laboratory results
- Billing and invoices

## Technologies Used

- Node.js with Express
- MongoDB with Mongoose
- JWT Authentication
- Twilio for telemedicine
- Winston for logging