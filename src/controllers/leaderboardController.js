import Attempt from '../models/Attempt.js';
import Test from '../models/Test.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

/**
 * @desc Get leaderboard stats
 * @route GET /api/leaderboard
 */
export const getLeaderboard = async (req, res, next) => {
  try {
    const { batchId, testId, month } = req.query;

    // Filter attempts query
    const attemptQuery = { status: { $in: ['submitted', 'graded'] } };

    // 1. Filter by Test ID
    if (testId) {
      attemptQuery.test = new mongoose.Types.ObjectId(testId);
      
      // Fetch test details for total marks references
      const test = await Test.findById(testId);
      if (!test) {
        res.status(404);
        throw new Error('Test not found');
      }

      const attempts = await Attempt.find(attemptQuery)
        .populate('student', 'name email avatar')
        .sort({ marksObtained: -1, submittedAt: 1 });

      const leaderboard = attempts.map((att, index) => {
        // Calculate dynamic badge just in case
        const percentage = (att.marksObtained / test.totalMarks) * 100;
        let badge = 'none';
        if (percentage === 100) badge = 'gold';
        else if (percentage >= 90) badge = 'silver';

        return {
          rank: index + 1,
          studentName: att.student?.name || 'Deleted Student',
          studentAvatar: att.student?.avatar || '',
          studentId: att.student?._id || null,
          score: att.marksObtained,
          maxScore: test.totalMarks,
          percentage: Number(percentage.toFixed(1)),
          badge: badge,
        };
      });

      return res.json(leaderboard);
    }

    // 2. Filter by Batch ID (Cumulative Batch Leaderboard)
    if (batchId) {
      // Find all published tests in this batch
      const tests = await Test.find({ batch: batchId });
      const testIds = tests.map((t) => t._id);
      attemptQuery.test = { $in: testIds };
    }

    // 3. Filter by Month (e.g. "2026-06")
    if (month) {
      const yearStr = month.split('-')[0];
      const monthStr = month.split('-')[1];
      const startDate = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      const endDate = new Date(Number(yearStr), Number(monthStr), 0, 23, 59, 59);
      attemptQuery.submittedAt = { $gte: startDate, $lte: endDate };
    }

    // Cumulative aggregation grouped by student
    const pipeline = [
      { $match: attemptQuery },
      // Join with tests to get totalMarks weighting
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testDetails',
        },
      },
      { $unwind: '$testDetails' },
      // Group by student
      {
        $group: {
          _id: '$student',
          totalMarksObtained: { $sum: '$marksObtained' },
          totalMarksPossible: { $sum: '$testDetails.totalMarks' },
          testsAttempted: { $sum: 1 },
        },
      },
      // Join user info
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'studentInfo',
        },
      },
      { $unwind: '$studentInfo' },
      // Filter out users not approved or if batchId is filtered, make sure user batch matches
      {
        $match: batchId
          ? { 'studentInfo.batch': new mongoose.Types.ObjectId(batchId) }
          : {},
      },
      // Project fields
      {
        $project: {
          studentId: '$_id',
          studentName: '$studentInfo.name',
          studentAvatar: '$studentInfo.avatar',
          score: '$totalMarksObtained',
          maxScore: '$totalMarksPossible',
          testsAttempted: '$testsAttempted',
          percentage: {
            $cond: [
              { $gt: ['$totalMarksPossible', 0] },
              { $multiply: [{ $divide: ['$totalMarksObtained', '$totalMarksPossible'] }, 100] },
              0,
            ],
          },
        },
      },
      // Sort by cumulative score descending
      { $sort: { score: -1, percentage: -1 } },
    ];

    const aggregatedBoard = await Attempt.aggregate(pipeline);

    // Add rank and badge details
    const leaderboard = aggregatedBoard.map((item, index) => {
      let badge = 'none';
      if (item.percentage === 100) badge = 'gold';
      else if (item.percentage >= 90) badge = 'silver';

      return {
        rank: index + 1,
        studentName: item.studentName,
        studentAvatar: item.studentAvatar,
        studentId: item.studentId,
        score: item.score,
        maxScore: item.maxScore,
        percentage: Number(item.percentage.toFixed(1)),
        badge: badge,
        testsAttempted: item.testsAttempted,
      };
    });

    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
};
