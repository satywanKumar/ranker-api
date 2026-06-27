import express from 'express';
import {
  getAttendance,
  saveAttendance,
  getStudentAttendance,
  getMyAttendance,
} from '../controllers/attendanceController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Admin-only endpoints to get and save daily logs
router.route('/')
  .get(protect, adminOnly, getAttendance)
  .post(protect, adminOnly, saveAttendance);

// Student personal stats (student authorized)
router.get('/student/me', protect, getMyAttendance);

// Admin query for a specific student's attendance performance
router.get('/student/:studentId', protect, adminOnly, getStudentAttendance);

export default router;
