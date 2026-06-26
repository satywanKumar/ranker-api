import express from 'express';
import { 
  getStudentAnalytics, 
  getAdminAnalytics,
  getStudentAnalyticsForAdmin,
} from '../controllers/analyticsController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.get('/student', protect, getStudentAnalytics);
router.get('/admin', protect, adminOnly, getAdminAnalytics);
router.get('/admin/student/:studentId', protect, adminOnly, getStudentAnalyticsForAdmin);

export default router;
