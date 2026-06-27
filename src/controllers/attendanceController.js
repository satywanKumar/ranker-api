import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * @desc Get attendance list for a batch and date
 * @route GET /api/attendance
 */
export const getAttendance = async (req, res, next) => {
  try {
    const { batchId, date } = req.query;

    if (!batchId || !date) {
      res.status(400);
      throw new Error('Batch ID and date are required');
    }

    // 1. Fetch all approved students in this batch
    const students = await User.find({
      batch: batchId,
      role: 'student',
      status: 'approved',
    })
      .select('name email avatar')
      .sort({ name: 1 });

    // 2. Find if attendance has already been taken for this date
    const attendanceSheet = await Attendance.findOne({ batch: batchId, date });

    let records = [];
    if (attendanceSheet) {
      const statusMap = {};
      attendanceSheet.records.forEach((r) => {
        if (r.student) {
          statusMap[r.student.toString()] = r.status;
        }
      });

      records = students.map((student) => ({
        studentId: student._id,
        studentName: student.name,
        email: student.email,
        avatar: student.avatar || '',
        status: statusMap[student._id.toString()] || 'present', // fallback to present if newly added
      }));
    } else {
      // Default all to present if no attendance record exists yet
      records = students.map((student) => ({
        studentId: student._id,
        studentName: student.name,
        email: student.email,
        avatar: student.avatar || '',
        status: 'present',
      }));
    }

    res.json({
      batchId,
      date,
      records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Save or update attendance list for a batch and date
 * @route POST /api/attendance
 */
export const saveAttendance = async (req, res, next) => {
  try {
    const { batchId, date, records } = req.body;

    if (!batchId || !date || !Array.isArray(records)) {
      res.status(400);
      throw new Error('Batch ID, date, and records array are required');
    }

    const recordsMapped = records.map((r) => ({
      student: new mongoose.Types.ObjectId(r.studentId),
      status: r.status,
    }));

    // Find and update if exists, or create a new sheet (upsert)
    const attendanceSheet = await Attendance.findOneAndUpdate(
      { batch: batchId, date },
      { batch: batchId, date, records: recordsMapped },
      { new: true, upsert: true }
    );

    res.status(200).json({
      message: 'Attendance saved successfully',
      attendanceSheet,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get attendance stats and logs for a specific student
 * @route GET /api/attendance/student/:studentId
 */
export const getStudentAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findById(studentId);
    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }

    // Fetch all attendance sheets for the student's batch
    const attendanceSheets = await Attendance.find({ batch: student.batch }).sort({ date: -1 });

    let totalDays = 0;
    let presentDays = 0;
    const history = [];

    attendanceSheets.forEach((sheet) => {
      const record = sheet.records.find((r) => r.student && r.student.toString() === studentId);
      if (record) {
        totalDays++;
        if (record.status === 'present') {
          presentDays++;
        }
        history.push({
          date: sheet.date,
          status: record.status,
        });
      }
    });

    const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    res.json({
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        avatar: student.avatar || '',
      },
      totalDays,
      presentDays,
      percentage: Number(percentage.toFixed(1)),
      history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get attendance stats for the currently logged in student
 * @route GET /api/attendance/student/me
 */
export const getMyAttendance = async (req, res, next) => {
  try {
    req.params.studentId = req.user._id.toString();
    await getStudentAttendance(req, res, next);
  } catch (error) {
    next(error);
  }
};
