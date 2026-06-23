import Batch from '../models/Batch.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

/**
 * @desc Get all batches (Admin: all, Student: active ones)
 * @route GET /api/batches
 */
export const getBatches = async (req, res, next) => {
  try {
    let batches;
    if (req.user.role === 'admin') {
      batches = await Batch.find({}).sort({ createdAt: -1 });
    } else {
      batches = await Batch.find({ status: 'active' }).sort({ name: 1 });
    }

    const batchesWithCount = await Promise.all(
      batches.map(async (batch) => {
        const studentCount = await User.countDocuments({
          batch: batch._id,
          status: 'approved',
          role: 'student',
        });
        return {
          ...batch.toObject(),
          studentCount,
        };
      })
    );

    res.json(batchesWithCount);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get batch by ID
 * @route GET /api/batches/:id
 */
export const getBatchById = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      res.status(404);
      throw new Error('Batch not found');
    }
    
    // Also fetch students enrolled in this batch
    const students = await User.find({ batch: batch._id, status: 'approved' }).select('name email avatar');
    
    res.json({ batch, students });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create new batch
 * @route POST /api/batches
 */
export const createBatch = async (req, res, next) => {
  try {
    const { name, description, startDate } = req.body;

    let thumbnailUrl = '';
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'thumbnails');
      thumbnailUrl = uploadResult.secure_url;
    }

    const batch = await Batch.create({
      name,
      description,
      startDate: startDate || new Date(),
      thumbnail: thumbnailUrl,
      status: 'active',
    });

    res.status(201).json(batch);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update batch details
 * @route PUT /api/batches/:id
 */
export const updateBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      res.status(404);
      throw new Error('Batch not found');
    }

    batch.name = req.body.name || batch.name;
    batch.description = req.body.description !== undefined ? req.body.description : batch.description;
    batch.status = req.body.status || batch.status;
    batch.startDate = req.body.startDate || batch.startDate;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'thumbnails');
      batch.thumbnail = uploadResult.secure_url;
    }

    const updatedBatch = await batch.save();
    res.json(updatedBatch);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete batch
 * @route DELETE /api/batches/:id
 */
export const deleteBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      res.status(404);
      throw new Error('Batch not found');
    }

    // Delete thumbnail from Cloudinary if it exists
    if (batch.thumbnail) {
      await deleteFromCloudinary(batch.thumbnail, 'image');
    }

    // Set batch to null for all students in this batch
    await User.updateMany({ batch: batch._id }, { batch: null, status: 'pending' });

    await batch.deleteOne();
    res.json({ message: 'Batch removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Request to join a batch (Student)
 * @route POST /api/batches/:id/join
 */
export const requestToJoinBatch = async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.id);
    if (!batch) {
      res.status(404);
      throw new Error('Batch not found');
    }

    if (batch.status !== 'active') {
      res.status(400);
      throw new Error('Batch is inactive and cannot be joined');
    }

    const user = await User.findById(req.user._id);
    user.batch = batch._id;
    user.status = 'pending';
    await user.save();

    res.json({ message: 'Join request sent. Waiting for admin approval.', user });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get all pending join requests (Admin)
 * @route GET /api/batches/requests/pending
 */
export const getPendingRequests = async (req, res, next) => {
  try {
    const pendingStudents = await User.find({ status: 'pending', batch: { $ne: null } })
      .populate('batch', 'name')
      .select('name email avatar batch createdAt');
    res.json(pendingStudents);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Approve/Reject pending request (Admin)
 * @route POST /api/batches/requests/:studentId/:action
 */
export const handleJoinRequest = async (req, res, next) => {
  try {
    const { studentId, action } = req.params; // action = approve / reject
    const student = await User.findById(studentId).populate('batch');

    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }

    if (action === 'approve') {
      student.status = 'approved';
      await student.save();

      // Create success notification
      await Notification.create({
        user: student._id,
        title: 'Batch Join Approved',
        message: `Your request to join the batch ${student.batch.name} has been approved. You can now access tests and analytics.`,
        type: 'join_approved',
      });

      res.json({ message: 'Request approved successfully', student });
    } else if (action === 'reject') {
      const oldBatchName = student.batch ? student.batch.name : 'requested batch';
      student.batch = null;
      student.status = 'pending';
      await student.save();

      // Notify rejection/resubmission status
      await Notification.create({
        user: student._id,
        title: 'Batch Join Rejected',
        message: `Your request to join the batch ${oldBatchName} was rejected. Please select a different batch or contact support.`,
        type: 'general',
      });

      res.json({ message: 'Request rejected/reset successfully', student });
    } else {
      res.status(400);
      throw new Error('Invalid request action');
    }
  } catch (error) {
    next(error);
  }
};
