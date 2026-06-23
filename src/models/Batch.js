import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Batch name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

const Batch = mongoose.model('Batch', batchSchema);
export default Batch;
