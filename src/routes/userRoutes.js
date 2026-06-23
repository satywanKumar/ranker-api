import express from 'express';
import {
  getUsers,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.route('/')
  .get(getUsers);

router.route('/:id')
  .put(updateUser)
  .delete(deleteUser);

export default router;
