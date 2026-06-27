import mongoose from 'mongoose';

const testSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    duration: {
      type: Number, // in minutes
      required: [true, 'Duration is required'],
    },
    validTill: {
      type: Date,
      required: [true, 'Validity date is required'],
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
    },
    negativeMarking: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['mcq', 'subjective', 'coding'],
      required: [true, 'Test type is required'],
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: [true, 'Batch reference is required'],
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    // Subjective fields
    questionPaperUrl: {
      type: String,
      default: '',
    },
    deadline: {
      type: Date,
    },
    // Coding fields
    startDate: {
      type: Date,
      default: Date.now,
    },
    passingMarks: {
      type: Number,
      default: 0,
    },
    instructions: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Test = mongoose.model('Test', testSchema);
export default Test;
