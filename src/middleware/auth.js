import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Generate Access Token (short-lived)
 */
export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'supersecretaccesskey123!@#',
    { expiresIn: '7d' }
  );
};

/**
 * Generate Refresh Token (long-lived)
 */
export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET || 'supersecretrefreshkey456!@#',
    { expiresIn: '30d' }
  );
};

/**
 * Protect routes - Verifies JWT Access Token
 */
export const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretaccesskey123!@#');

      // Fetch user and attach to request
      req.user = await User.findById(decoded.id);
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      next();
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(401).json({ message: 'Not authorized, token expired or invalid' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

/**
 * Restrict routes to Admin role only
 */
export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Forbidden, admin access only' });
  }
};
