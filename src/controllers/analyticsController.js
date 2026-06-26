import Test from '../models/Test.js';
import Attempt from '../models/Attempt.js';
import User from '../models/User.js';
import Batch from '../models/Batch.js';
import mongoose from 'mongoose';

/**
 * @desc Get analytics for student dashboard
 * @route GET /api/analytics/student
 */
export const getStudentAnalytics = async (req, res, next) => {
  try {
    const studentId = req.user._id;

    if (!req.user.batch) {
      return res.json({
        upcomingTests: 0,
        completedTests: 0,
        avgScore: 0,
        currentRank: 0,
        history: [],
        progress: [],
      });
    }

    // 1. Completed Tests
    const completedAttempts = await Attempt.find({
      student: studentId,
      status: { $in: ['submitted', 'graded'] },
    }).populate('test', 'name totalMarks type');

    const completedCount = completedAttempts.length;

    // 2. Average Score (Percentage)
    let totalPercent = 0;
    completedAttempts.forEach((att) => {
      const maxScore = att.test?.totalMarks || 1;
      totalPercent += (att.marksObtained / maxScore) * 100;
    });
    const avgScore = completedCount > 0 ? Number((totalPercent / completedCount).toFixed(1)) : 0;

    // 3. Upcoming Tests (published, validTill > now, no attempt yet)
    const attemptedTestIds = await Attempt.find({ student: studentId }).distinct('test');
    const upcomingTestsCount = await Test.countDocuments({
      batch: req.user.batch,
      status: 'published',
      validTill: { $gt: new Date() },
      _id: { $nin: attemptedTestIds },
    });

    // 4. Current Rank (Aggregate all student scores in their batch)
    const batchStudents = await User.find({ batch: req.user.batch, status: 'approved' }).distinct('_id');
    const ranksPipeline = [
      {
        $match: {
          student: { $in: batchStudents },
          status: { $in: ['submitted', 'graded'] },
        },
      },
      {
        $lookup: {
          from: 'tests',
          localField: 'test',
          foreignField: '_id',
          as: 'testDetails',
        },
      },
      { $unwind: '$testDetails' },
      {
        $group: {
          _id: '$student',
          score: { $sum: '$marksObtained' },
          maxScore: { $sum: '$testDetails.totalMarks' },
        },
      },
      {
        $project: {
          percentage: {
            $cond: [{ $gt: ['$maxScore', 0] }, { $multiply: [{ $divide: ['$score', '$maxScore'] }, 100] }, 0],
          },
        },
      },
      { $sort: { score: -1, percentage: -1 } },
    ];
    const rankResults = await Attempt.aggregate(ranksPipeline);
    const studentRankIdx = rankResults.findIndex((r) => r._id.toString() === studentId.toString());
    const currentRank = studentRankIdx !== -1 ? studentRankIdx + 1 : batchStudents.length;

    // 5. Test history formatted for charts & tables
    const history = completedAttempts.map((att) => {
      const maxScore = att.test?.totalMarks || 100;
      const pct = (att.marksObtained / maxScore) * 100;
      return {
        testId: att.test?._id || '',
        testName: att.test?.name || 'Deleted Test',
        testType: att.test?.type || 'mcq',
        marksObtained: att.marksObtained,
        totalMarks: maxScore,
        percentage: Number(pct.toFixed(1)),
        badge: att.badge,
        date: att.submittedAt || att.updatedAt,
      };
    });

    // 6. Progress Trends (sorted by time)
    const progress = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      upcomingTests: upcomingTestsCount,
      completedTests: completedCount,
      avgScore,
      currentRank,
      history,
      progress,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get analytics for admin dashboard
 * @route GET /api/analytics/admin
 */
export const getAdminAnalytics = async (req, res, next) => {
  try {
    // 1. Counters
    const totalStudents = await User.countDocuments({ role: 'student', status: 'approved' });
    const totalTests = await Test.countDocuments({});
    const totalBatches = await Batch.countDocuments({});
    const pendingJoinRequests = await User.countDocuments({ status: 'pending', batch: { $ne: null } });

    // 2. Completion rate
    // Theoretical total possible completions = Sum of (Students in batch * published tests of batch)
    const batches = await Batch.find({ status: 'active' });
    let totalAssignments = 0;
    for (const batch of batches) {
      const studentCount = await User.countDocuments({ batch: batch._id, status: 'approved' });
      const testCount = await Test.countDocuments({ batch: batch._id, status: 'published' });
      totalAssignments += studentCount * testCount;
    }

    const totalSubmissions = await Attempt.countDocuments({ status: { $in: ['submitted', 'graded'] } });
    const completionRate = totalAssignments > 0 ? Number(((totalSubmissions / totalAssignments) * 100).toFixed(1)) : 0;

    // 3. Submission trends (past 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyTrends = await Attempt.aggregate([
      {
        $match: {
          status: { $in: ['submitted', 'graded'] },
          submittedAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const submissionTrends = monthlyTrends.map((trend) => {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      return {
        month: `${monthNames[trend._id.month - 1]} ${trend._id.year}`,
        count: trend.count,
      };
    });

    // 4. Daily Activity (past 7 days submissions)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyActivityAgg = await Attempt.aggregate([
      {
        $match: {
          status: { $in: ['submitted', 'graded'] },
          submittedAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyActivity = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const found = dailyActivityAgg.find((item) => item._id === key);
      dailyActivity.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
        count: found ? found.count : 0,
        sortKey: key,
      });
    }
    dailyActivity.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    // 5. Batch Performance (Average Score)
    const batchPerformance = [];
    const activeBatches = await Batch.find({});
    for (const batch of activeBatches) {
      const batchTests = await Test.find({ batch: batch._id }).distinct('_id');
      const avgBatchAgg = await Attempt.aggregate([
        {
          $match: {
            test: { $in: batchTests },
            status: { $in: ['submitted', 'graded'] },
          },
        },
        {
          $lookup: {
            from: 'tests',
            localField: 'test',
            foreignField: '_id',
            as: 'testDetails',
          },
        },
        { $unwind: '$testDetails' },
        {
          $group: {
            _id: null,
            score: { $sum: '$marksObtained' },
            maxScore: { $sum: '$testDetails.totalMarks' },
          },
        },
      ]);

      const scorePercent =
        avgBatchAgg.length > 0 && avgBatchAgg[0].maxScore > 0
          ? Number(((avgBatchAgg[0].score / avgBatchAgg[0].maxScore) * 100).toFixed(1))
          : 0;

      batchPerformance.push({
        batchId: batch._id,
        batchName: batch.name,
        avgScore: scorePercent,
      });
    }

    res.json({
      totalStudents,
      totalTests,
      totalBatches,
      pendingJoinRequests,
      completionRate,
      submissionTrends,
      dailyActivity,
      batchPerformance,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get complete analytics and test records for a specific student (Admin Only)
 * @route GET /api/analytics/admin/student/:studentId
 */
export const getStudentAnalyticsForAdmin = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const student = await User.findById(studentId).populate('batch', 'name');
    if (!student) {
      res.status(404);
      throw new Error('Student not found');
    }

    // Fetch all attempts for this student
    const attempts = await Attempt.find({ student: studentId })
      .populate('test', 'name totalMarks type duration')
      .sort({ createdAt: -1 });

    const history = [];
    for (const att of attempts) {
      const isCompleted = att.status === 'submitted' || att.status === 'graded';
      
      let rankInTest = '--';
      if (isCompleted && att.test) {
        const higherAttemptsCount = await Attempt.countDocuments({
          test: att.test._id,
          status: { $in: ['submitted', 'graded'] },
          marksObtained: { $gt: att.marksObtained }
        });
        rankInTest = higherAttemptsCount + 1;
      }

      history.push({
        attemptId: att._id,
        testId: att.test?._id || '',
        testName: att.test?.name || 'Deleted Test',
        testType: att.test?.type || 'mcq',
        marksObtained: att.marksObtained,
        totalMarks: att.test?.totalMarks || 100,
        percentage: att.test?.totalMarks ? Number(((att.marksObtained / att.test.totalMarks) * 100).toFixed(1)) : 0,
        badge: att.badge,
        status: att.status,
        startTime: att.startTime,
        submittedAt: att.submittedAt,
        timeTaken: att.submittedAt && att.startTime 
          ? Math.floor((new Date(att.submittedAt) - new Date(att.startTime)) / 1000) // in seconds
          : null,
        rankInTest,
        date: att.submittedAt || att.createdAt,
      });
    }

    // Sort by date ascending for progress trend
    const progress = [...history]
      .filter(h => h.status === 'submitted' || h.status === 'graded')
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Overall summary metrics
    const completedAttempts = history.filter(h => h.status === 'submitted' || h.status === 'graded');
    const completedCount = completedAttempts.length;
    
    let totalPercent = 0;
    let highestScore = 0;
    let lowestScore = 100;
    
    completedAttempts.forEach(h => {
      totalPercent += h.percentage;
      if (h.percentage > highestScore) highestScore = h.percentage;
      if (h.percentage < lowestScore) lowestScore = h.percentage;
    });

    if (completedCount === 0) lowestScore = 0;

    const avgScore = completedCount > 0 ? Number((totalPercent / completedCount).toFixed(1)) : 0;

    res.json({
      student,
      summary: {
        completedTests: completedCount,
        avgScore,
        highestScore: Number(highestScore.toFixed(1)),
        lowestScore: Number(lowestScore.toFixed(1)),
      },
      history,
      progress,
    });
  } catch (error) {
    next(error);
  }
};
