import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken } from '../middleware/auth.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import jwt from 'jsonwebtoken';

/**
 * @desc Register user
 * @route POST /api/auth/register
 */
export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error('User already exists');
    }

    // Set role. Default to student. If admin, check if first user or require registration approval.
    const userRole = role === 'admin' ? 'admin' : 'student';
    // Admins are approved automatically; students must join a batch/wait for approval.
    const status = userRole === 'admin' ? 'approved' : 'pending';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      status,
    });

    if (user) {
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Save refresh token
      user.refreshToken = refreshToken;
      await user.save();

      res.status(201).json({
        user,
        accessToken,
        refreshToken,
      });
    } else {
      res.status(400);
      throw new Error('Invalid user data');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Auth user & get token
 * @route POST /api/auth/login
 */
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('batch', 'name');
    if (user && (await user.comparePassword(password))) {
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Update user's refresh token
      user.refreshToken = refreshToken;
      await user.save();

      res.json({
        user,
        accessToken,
        refreshToken,
      });
    } else {
      res.status(401);
      throw new Error('Invalid email or password');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Refresh Access Token
 * @route POST /api/auth/refresh
 */
export const refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400);
      throw new Error('Refresh token is required');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey456!@#');
    } catch (err) {
      res.status(401);
      throw new Error('Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.refreshToken) {
      res.status(401);
      throw new Error('Token does not match stored token or user has been logged out');
    }

    const newAccessToken = generateAccessToken(user);
    res.json({ accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Logout user
 * @route POST /api/auth/logout
 */
export const logoutUser = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = '';
        await user.save();
      }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get user profile
 * @route GET /api/auth/me
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('batch');
    if (user) {
      res.json(user);
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update user profile / upload avatar
 * @route PUT /api/auth/me
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      
      if (req.body.password) {
        user.password = req.body.password;
      }

      // Check if file is uploaded
      if (req.file) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'avatars');
        user.avatar = uploadResult.secure_url;
      }

      const updatedUser = await user.save();
      const populatedUser = await User.findById(updatedUser._id).populate('batch');

      res.json(populatedUser);
    } else {
      res.status(404);
      throw new Error('User not found');
    }
  } catch (error) {
    next(error);
  }
};
