import mongoose from 'mongoose';

const codingQuestionSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: [true, 'Test reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    problemStatement: {
      type: String,
      required: [true, 'Problem statement is required'],
    },
    constraints: {
      type: String,
      default: '',
    },
    inputFormat: {
      type: String,
      default: '',
    },
    outputFormat: {
      type: String,
      default: '',
    },
    sampleInput: {
      type: String,
      default: '',
    },
    sampleOutput: {
      type: String,
      default: '',
    },
    explanation: {
      type: String,
      default: '',
    },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      default: 'Medium',
    },
    marks: {
      type: Number,
      default: 10,
    },
    hiddenTestCases: [
      {
        input: { type: String, default: '' },
        expectedOutput: { type: String, default: '' },
      },
    ],
    visibleTestCases: [
      {
        input: { type: String, default: '' },
        expectedOutput: { type: String, default: '' },
      },
    ],
    questionType: {
      type: String,
      enum: [
        'Output Prediction',
        'Debugging',
        'Code Writing',
        'Algorithm Based',
        'SQL',
        'Web Development',
        'DSA',
        'AI/ML Theory',
        'Custom',
      ],
      default: 'Code Writing',
    },
    supportedLanguages: {
      type: [String],
      default: ['javascript', 'python', 'c', 'cpp', 'java'],
    },
    starterCode: {
      type: Map,
      of: String,
      default: {},
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const CodingQuestion = mongoose.model('CodingQuestion', codingQuestionSchema);
export default CodingQuestion;
