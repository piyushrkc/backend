// src/tests/integration/appointments.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Appointment = require('../../models/Appointment');
const Hospital = require('../../models/Hospital');
const { createTestUser, createTestHospital, generateAuthToken } = require('../helpers');

describe('Appointment API Endpoints', () => {
  let testHospital;
  let doctorUser;
  let patientUser;
  let adminUser;
  let doctorToken;
  let patientToken;
  let adminToken;

  beforeAll(async () => {
    // Create a test hospital
    testHospital = await createTestHospital();

    // Create test users with different roles
    doctorUser = await createTestUser({
      email: 'doctor@example.com',
      role: 'doctor',
      hospital: testHospital._id,
      specialization: 'Cardiology'
    });

    patientUser = await createTestUser({
      email: 'patient@example.com',
      role: 'patient',
      hospital: testHospital._id
    });

    adminUser = await createTestUser({
      email: 'admin@example.com',
      role: 'admin',
      hospital: testHospital._id
    });

    // Generate tokens for authenticated requests
    doctorToken = generateAuthToken(doctorUser);
    patientToken = generateAuthToken(patientUser);
    adminToken = generateAuthToken(adminUser);
  });

  describe('GET /api/appointments', () => {
    beforeEach(async () => {
      // Create test appointments
      await Appointment.create([
        {
          doctor: doctorUser._id,
          patient: patientUser._id,
          hospital: testHospital._id,
          date: new Date(),
          status: 'scheduled',
          reason: 'Regular checkup'
        },
        {
          doctor: doctorUser._id,
          patient: patientUser._id,
          hospital: testHospital._id,
          date: new Date(Date.now() + 86400000), // Tomorrow
          status: 'scheduled',
          reason: 'Follow-up'
        }
      ]);
    });

    it('should return all appointments for admin users', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body.appointments)).toBe(true);
      expect(response.body.appointments.length).toBe(2);
      expect(response.body.success).toBe(true);
    });

    it('should return only own appointments for doctors', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(Array.isArray(response.body.appointments)).toBe(true);
      expect(response.body.appointments.length).toBe(2);
      expect(response.body.appointments[0].doctor._id).toBe(doctorUser._id.toString());
    });

    it('should return only own appointments for patients', async () => {
      const response = await request(app)
        .get('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(Array.isArray(response.body.appointments)).toBe(true);
      expect(response.body.appointments.length).toBe(2);
      expect(response.body.appointments[0].patient._id).toBe(patientUser._id.toString());
    });

    it('should filter appointments by date range', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const response = await request(app)
        .get('/api/appointments')
        .query({ 
          startDate: tomorrow.toISOString().split('T')[0],
          endDate: tomorrow.toISOString().split('T')[0]
        })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.appointments.length).toBe(1);
      expect(response.body.appointments[0].reason).toBe('Follow-up');
    });

    it('should filter appointments by status', async () => {
      // Update one appointment to 'cancelled'
      const appointment = await Appointment.findOne({ reason: 'Regular checkup' });
      appointment.status = 'cancelled';
      await appointment.save();

      const response = await request(app)
        .get('/api/appointments')
        .query({ status: 'cancelled' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.appointments.length).toBe(1);
      expect(response.body.appointments[0].status).toBe('cancelled');
    });

    it('should return 401 if not authenticated', async () => {
      await request(app)
        .get('/api/appointments')
        .expect(401);
    });
  });

  describe('POST /api/appointments', () => {
    it('should create a new appointment', async () => {
      const appointmentData = {
        doctorId: doctorUser._id,
        patientId: patientUser._id,
        date: new Date(Date.now() + 172800000), // Two days from now
        time: '10:00',
        reason: 'New appointment test',
        notes: 'Test notes'
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment).toBeDefined();
      expect(response.body.appointment.reason).toBe(appointmentData.reason);
      expect(response.body.appointment.status).toBe('scheduled');

      // Verify appointment was created in database
      const savedAppointment = await Appointment.findById(response.body.appointment._id);
      expect(savedAppointment).toBeTruthy();
      expect(savedAppointment.doctor.toString()).toBe(doctorUser._id.toString());
      expect(savedAppointment.patient.toString()).toBe(patientUser._id.toString());
    });

    it('should return 400 if required fields are missing', async () => {
      const invalidData = {
        // Missing doctorId and date
        patientId: patientUser._id,
        reason: 'Invalid appointment'
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation failed');
    });

    it('should return 404 if doctor does not exist', async () => {
      const appointmentData = {
        doctorId: new mongoose.Types.ObjectId(), // Non-existent doctor
        patientId: patientUser._id,
        date: new Date(Date.now() + 172800000),
        time: '10:00',
        reason: 'Invalid doctor appointment'
      };

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(appointmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Doctor not found');
    });
  });

  describe('GET /api/appointments/:id', () => {
    let testAppointment;

    beforeEach(async () => {
      // Create a test appointment
      testAppointment = await Appointment.create({
        doctor: doctorUser._id,
        patient: patientUser._id,
        hospital: testHospital._id,
        date: new Date(),
        status: 'scheduled',
        reason: 'Test appointment'
      });
    });

    it('should return appointment by ID', async () => {
      const response = await request(app)
        .get(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment._id).toBe(testAppointment._id.toString());
      expect(response.body.appointment.reason).toBe('Test appointment');
    });

    it('should return 404 if appointment not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .get(`/api/appointments/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should allow access to doctor of the appointment', async () => {
      const response = await request(app)
        .get(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment._id).toBe(testAppointment._id.toString());
    });

    it('should allow access to patient of the appointment', async () => {
      const response = await request(app)
        .get(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment._id).toBe(testAppointment._id.toString());
    });
  });

  describe('PUT /api/appointments/:id', () => {
    let testAppointment;

    beforeEach(async () => {
      // Create a test appointment
      testAppointment = await Appointment.create({
        doctor: doctorUser._id,
        patient: patientUser._id,
        hospital: testHospital._id,
        date: new Date(),
        status: 'scheduled',
        reason: 'Update test appointment'
      });
    });

    it('should update appointment status', async () => {
      const updateData = {
        status: 'completed',
        notes: 'Appointment completed successfully'
      };

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment.status).toBe('completed');
      expect(response.body.appointment.notes).toBe(updateData.notes);

      // Verify update in database
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(updatedAppointment.status).toBe('completed');
    });

    it('should allow patients to reschedule appointments', async () => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 7); // One week later
      
      const updateData = {
        date: newDate,
        time: '14:00',
        reason: 'Rescheduled appointment'
      };

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.appointment.reason).toBe('Rescheduled appointment');
      
      // Verify the date was updated
      const updatedAppointment = await Appointment.findById(testAppointment._id);
      expect(new Date(updatedAppointment.date).toDateString()).toBe(newDate.toDateString());
    });

    it('should prevent updating another patient\'s appointment', async () => {
      // Create another patient
      const anotherPatient = await createTestUser({
        email: 'another.patient@example.com',
        role: 'patient',
        hospital: testHospital._id
      });
      
      const anotherToken = generateAuthToken(anotherPatient);
      
      const updateData = {
        reason: 'Unauthorized update attempt'
      };

      const response = await request(app)
        .put(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not authorized');
    });
  });

  describe('DELETE /api/appointments/:id', () => {
    let testAppointment;

    beforeEach(async () => {
      // Create a test appointment
      testAppointment = await Appointment.create({
        doctor: doctorUser._id,
        patient: patientUser._id,
        hospital: testHospital._id,
        date: new Date(Date.now() + 604800000), // One week in the future
        status: 'scheduled',
        reason: 'Delete test appointment'
      });
    });

    it('should allow admins to delete appointments', async () => {
      const response = await request(app)
        .delete(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify deletion in database
      const deletedAppointment = await Appointment.findById(testAppointment._id);
      expect(deletedAppointment).toBeNull();
    });

    it('should allow patients to cancel their own appointments', async () => {
      const response = await request(app)
        .delete(`/api/appointments/${testAppointment._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // For patient cancellations, we might just change the status to 'cancelled'
      // rather than actually deleting from the database
      const cancelledAppointment = await Appointment.findById(testAppointment._id);
      expect(cancelledAppointment).toBeNull(); // Or check for status: 'cancelled' if that's the implementation
    });

    it('should return 404 if appointment not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .delete(`/api/appointments/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });
  });
});