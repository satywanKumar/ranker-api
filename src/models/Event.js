import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    date: {
      type: String, // stored in YYYY-MM-DD format
      required: true,
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Speed up retrieving events by batch and date
eventSchema.index({ batch: 1, date: 1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
