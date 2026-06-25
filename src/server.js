import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Config
import connectDB from './config/db.js';

// Middleware
import { notFound, errorHandler } from './middleware/error.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import testRoutes from './routes/testRoutes.js';
import attemptRoutes from './routes/attemptRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// CORS settings (placed at the top to avoid preflight issues with rate limiters/headers)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://ranker.sribsclasses.in',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean).map(url => url.replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const sanitizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(sanitizedOrigin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

// Security headers (allowing cross-origin resource sharing of assets)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);



// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Welcome test route
app.get('/', (req, res) => {
  res.json({ message: 'Coaching Test Platform API is running...' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/attempts', attemptRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/users', userRoutes);



// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
