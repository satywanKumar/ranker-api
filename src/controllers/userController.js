import User from '../models/User.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';

/**
 * @desc Get all registered students
 * @route GET /api/users
 */
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ role: 'student' })
      .populate('batch', 'name')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update user details
 * @route PUT /api/users/:id
 */
export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Student not found');
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    
    if (req.body.role) {
      user.role = req.body.role;
    }
    
    if (req.body.status) {
      user.status = req.body.status;
    }

    // Handle batch assignment or removal
    if (req.body.batch === '' || req.body.batch === null) {
      user.batch = null;
    } else if (req.body.batch) {
      user.batch = req.body.batch;
    }

    const updatedUser = await user.save();
    const populatedUser = await User.findById(populatedUser._id).populate('batch', 'name');
    res.json(populatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete student user
 * @route DELETE /api/users/:id
 */
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('Student not found');
    }

    if (user.avatar) {
      await deleteFromCloudinary(user.avatar, 'image');
    }

    await user.deleteOne();
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    next(error);
  }
};
