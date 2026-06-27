import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Batch',
      required: true,
      index: true,
    },
    date: {
      type: String, // stored in YYYY-MM-DD format
      required: true,
      index: true,
    },
    records: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['present', 'absent'],
          required: true,
          default: 'present',
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate attendance records for a batch on the same date
attendanceSchema.index({ batch: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
