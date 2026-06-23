import express from 'express';
import { uploadToCloudinary } from '../config/cloudinary.js';
import upload from '../middleware/multer.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, adminOnly, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No image file uploaded');
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, 'question_images');
    res.json({ url: uploadResult.secure_url });
  } catch (error) {
    next(error);
  }
});

export default router;
