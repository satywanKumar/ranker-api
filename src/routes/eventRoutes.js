import express from 'express';
import {
  getEvents,
  createEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Get list of events (authorized for both students and admins)
// Create list of events (authorized for admins only)
router.route('/')
  .get(protect, getEvents)
  .post(protect, adminOnly, createEvent);

// Delete individual event (authorized for admins only)
router.route('/:id')
  .delete(protect, adminOnly, deleteEvent);

export default router;
