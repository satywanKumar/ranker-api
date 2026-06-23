import express from 'express';
import { getStudentAnalytics, getAdminAnalytics } from '../controllers/analyticsController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/student', protect, getStudentAnalytics);
router.get('/admin', protect, adminOnly, getAdminAnalytics);

export default router;
