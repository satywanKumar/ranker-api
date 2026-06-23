import express from 'express';
import {
  getBatches,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
  requestToJoinBatch,
  getPendingRequests,
  handleJoinRequest,
} from '../controllers/batchController.js';
import { protect, adminOnly } from '../middleware/auth.js';
import upload from '../middleware/multer.js';

const router = express.Router();

// General Batch endpoints
router
  .route('/')
  .get(protect, getBatches)
  .post(protect, adminOnly, upload.single('thumbnail'), createBatch);

// Get pending request routes (Put BEFORE dynamic ID routes so it matches correctly)
router.get('/requests/pending', protect, adminOnly, getPendingRequests);
router.post('/requests/:studentId/:action', protect, adminOnly, handleJoinRequest);

router
  .route('/:id')
  .get(protect, getBatchById)
  .put(protect, adminOnly, upload.single('thumbnail'), updateBatch)
  .delete(protect, adminOnly, deleteBatch);

router.post('/:id/join', protect, requestToJoinBatch);

export default router;
