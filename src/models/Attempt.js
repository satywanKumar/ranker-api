import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    type: {
      type: String,
      enum: ['mcq', 'subjective', 'coding'],
      required: true,
    },
    // MCQ answers: questionId (string) -> selected index (number)
    answers: {
      type: Map,
      of: Number,
      default: {},
    },
    // Subjective submissions
    subjectiveAnswerUrl: {
      type: String,
      default: '',
    },
    subjectiveCheckedUrl: {
      type: String,
      default: '', // Flattend PDF uploaded to Cloudinary (optional/Option B fallback)
    },
    // Browser drawing layers/comments (Option A annotation coordinate storage)
    annotations: {
      type: Array, // Stores coordinates, ticks, textboxes, lines, pages, colors
      default: [],
    },
    // Coding submissions: questionId (string) -> coding answer metadata
    codingSubmissions: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['started', 'submitted', 'graded'],
      default: 'started',
    },
    marksObtained: {
      type: Number,
      default: 0,
    },
    badge: {
      type: String,
      enum: ['gold', 'silver', 'none'],
      default: 'none',
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    // Time spent on each question (questionId -> time in seconds)
    timeSpent: {
      type: Map,
      of: Number,
      default: {},
    },
    submittedAt: {
      type: Date,
    },
    gradedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for leaderboard speed-ups
attemptSchema.index({ test: 1, marksObtained: -1 });
attemptSchema.index({ student: 1, test: 1 }, { unique: true });

const Attempt = mongoose.model('Attempt', attemptSchema);
export default Attempt;
