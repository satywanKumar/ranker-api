import express from 'express';
import { generateAIQuestions, evaluateCodeAI } from '../controllers/aiController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/generate-questions', protect, adminOnly, generateAIQuestions);
router.post('/evaluate-code/:attemptId/:questionId', protect, adminOnly, evaluateCodeAI);

export default router;
