import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
const server = http.createServer(app);

// Socket.io initialization
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Attach io instance to request object for route-level access
app.use((req, res, next) => {
  req.io = io;
  next();
});

// CORS settings (placed at the top to avoid preflight issues with rate limiters/headers)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
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

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

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

// Socket.io Events
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins room based on their ID
  socket.on('join_user', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their personal room`);
  });

  // User joins room based on their batch
  socket.on('join_batch', (batchId) => {
    socket.join(batchId);
    console.log(`User joined batch room: ${batchId}`);
  });

  // Admins room
  socket.on('join_admin', () => {
    socket.join('admins');
    console.log('Admin joined admin channel');
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
