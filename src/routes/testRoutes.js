import express from 'express';
import {
  getTests,
  getTestById,
  createTest,
  updateTest,
  deleteTest,
  duplicateTest,
  uploadQuestionPaper,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  duplicateQuestion,
  getCodingQuestionsByTest,
  addCodingQuestion,
  updateCodingQuestion,
  deleteCodingQuestion,
  reorderCodingQuestions,
  duplicateCodingQuestion,
} from '../controllers/testController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import upload from '../middleware/multer.js';

const router = express.Router();

// General Test Routes
router
  .route('/')
  .get(protect, getTests)
  .post(protect, adminOnly, createTest);

router.post('/upload-paper', protect, adminOnly, upload.single('paper'), uploadQuestionPaper);

router
  .route('/:id')
  .get(protect, getTestById)
  .put(protect, adminOnly, updateTest)
  .delete(protect, adminOnly, deleteTest);

router.post('/:id/duplicate', protect, adminOnly, duplicateTest);

// Question Builder Routes
router.post('/:id/questions', protect, adminOnly, addQuestion);
router.put('/:id/questions/reorder', protect, adminOnly, reorderQuestions);

router
  .route('/:id/questions/:questionId')
  .put(protect, adminOnly, updateQuestion)
  .delete(protect, adminOnly, deleteQuestion);

router.post('/:id/questions/:questionId/duplicate', protect, adminOnly, duplicateQuestion);

// Coding Question Builder Routes
router.get('/:id/coding-questions', protect, getCodingQuestionsByTest);
router.post('/:id/coding-questions', protect, adminOnly, addCodingQuestion);
router.put('/:id/coding-questions/reorder', protect, adminOnly, reorderCodingQuestions);

router
  .route('/:id/coding-questions/:questionId')
  .put(protect, adminOnly, updateCodingQuestion)
  .delete(protect, adminOnly, deleteCodingQuestion);

router.post('/:id/coding-questions/:questionId/duplicate', protect, adminOnly, duplicateCodingQuestion);

export default router;
