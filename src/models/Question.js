import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: [true, 'Test reference is required'],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    questionText: {
      type: String,
      default: '',
    },
    options: {
      type: [String],
      validate: {
        validator: function (v) {
          return v.length === 4;
        },
        message: 'There must be exactly 4 options',
      },
      required: true,
    },
    correctAnswer: {
      type: Number, // 0, 1, 2, 3
      required: [true, 'Correct option index is required'],
      min: 0,
      max: 3,
    },
    marks: {
      type: Number,
      default: 4,
    },
    negativeMarks: {
      type: Number,
      default: 1, // subtracted if negativeMarking is enabled on Test
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

const Question = mongoose.model('Question', questionSchema);
export default Question;
