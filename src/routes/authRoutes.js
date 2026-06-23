import express from 'express';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/multer.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logoutUser);

router
  .route('/me')
  .get(protect, getUserProfile)
  .put(protect, upload.single('avatar'), updateUserProfile);

export default router;
