import express from 'express';
import {
  getStudentAttempt,
  startAttempt,
  saveAttemptProgress,
  submitAttempt,
  submitSubjectivePDF,
  getSubjectiveSubmissions,
  gradeSubjectiveAttempt,
  proxyPDF,
  deleteAttempt,
  deleteAllAttemptsForTest,
} from '../controllers/attemptController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import upload from '../middleware/multer.js';

const router = express.Router();

// Student test progress endpoints
router.get('/test/:testId', protect, getStudentAttempt);
router.post('/test/:testId/start', protect, startAttempt);
router.post('/test/:testId/save', protect, saveAttemptProgress);
router.post('/test/:testId/submit', protect, submitAttempt);

// PDF Proxy endpoint (bypass CORS)
router.get('/proxy-pdf', protect, proxyPDF);

// Student subjective submit PDF endpoint
router.post(
  '/test/:testId/submit-subjective',
  protect,
  upload.single('submission'),
  submitSubjectivePDF
);

// Admin grading & evaluation endpoints
router.get('/test/:testId/evaluation', protect, adminOnly, getSubjectiveSubmissions);
router.post('/:id/grade', protect, adminOnly, gradeSubjectiveAttempt);
router.delete('/:id', protect, adminOnly, deleteAttempt);
router.delete('/test/:testId/all', protect, adminOnly, deleteAllAttemptsForTest);

export default router;
