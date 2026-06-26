import Attempt from '../models/Attempt.js';
import Test from '../models/Test.js';
import Question from '../models/Question.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import https from 'https';
import http from 'http';

/**
 * @desc Get student's attempt for a test
 * @route GET /api/attempts/test/:testId
 */
export const getStudentAttempt = async (req, res, next) => {
  try {
    let studentId = req.user._id;
    if (req.user.role === 'admin' && req.query.studentId) {
      studentId = req.query.studentId;
    }
    const attempt = await Attempt.findOne({
      student: studentId,
      test: req.params.testId,
    });
    res.json(attempt);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Start / Resume a test attempt
 * @route POST /api/attempts/test/:testId/start
 */
export const startAttempt = async (req, res, next) => {
  try {
    const testId = req.params.testId;
    const test = await Test.findById(testId);

    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    if (test.status !== 'published') {
      res.status(400);
      throw new Error('This test is not published yet');
    }

    // Verify if test validTill has passed
    if (new Date() > new Date(test.validTill)) {
      res.status(400);
      throw new Error('This test validity has expired');
    }

    // Check if attempt already exists
    let attempt = await Attempt.findOne({ student: req.user._id, test: testId });

    if (attempt) {
      if (attempt.status === 'submitted' || attempt.status === 'graded') {
        res.status(400);
        throw new Error('You have already submitted this test');
      }
      // If it exists but is 'started', resume it
      return res.json({ message: 'Resuming test attempt', attempt });
    }

    // Create new attempt
    attempt = await Attempt.create({
      student: req.user._id,
      test: testId,
      type: test.type,
      status: 'started',
      startTime: new Date(),
    });

    res.status(201).json({ message: 'Test attempt started', attempt });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Autosave MCQ progress
 * @route POST /api/attempts/test/:testId/save
 */
export const saveAttemptProgress = async (req, res, next) => {
  try {
    const { answers } = req.body; // map of questionId -> selectedIndex
    const attempt = await Attempt.findOne({ student: req.user._id, test: req.params.testId });

    if (!attempt) {
      res.status(404);
      throw new Error('Attempt not found');
    }

    if (attempt.status !== 'started') {
      res.status(400);
      throw new Error('Cannot save answers on a submitted test');
    }

    // Check time limit
    const test = await Test.findById(attempt.test);
    const timeLimitMs = (test.duration + 2) * 60 * 1000; // 2 minutes grace period
    const elapsedMs = new Date() - new Date(attempt.startTime);

    if (elapsedMs > timeLimitMs) {
      // Auto submit test if timer expired
      return await autoSubmitMCQ(attempt, test, res);
    }

    attempt.answers = answers;
    await attempt.save();

    res.json({ message: 'Progress saved successfully', attempt });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Manual submission of MCQ or subjective test
 * @route POST /api/attempts/test/:testId/submit
 */
export const submitAttempt = async (req, res, next) => {
  try {
    const testId = req.params.testId;
    const test = await Test.findById(testId);
    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    let attempt = await Attempt.findOne({ student: req.user._id, test: testId });
    if (!attempt) {
      res.status(404);
      throw new Error('Attempt not found');
    }

    if (attempt.status !== 'started') {
      res.status(400);
      throw new Error('Test is already submitted');
    }

    if (test.type === 'mcq') {
      // Evaluate MCQ
      const questions = await Question.find({ test: testId });
      let score = 0;

      questions.forEach((q) => {
        const studentAns = attempt.answers.get(q._id.toString());
        if (studentAns !== undefined && studentAns !== null) {
          if (Number(studentAns) === q.correctAnswer) {
            score += q.marks;
          } else {
            if (test.negativeMarking) {
              score -= q.negativeMarks;
            }
          }
        }
      });

      // Calculate Badge
      const percent = (score / test.totalMarks) * 100;
      let badge = 'none';
      if (percent === 100) badge = 'gold';
      else if (percent >= 90) badge = 'silver';

      attempt.marksObtained = score;
      attempt.badge = badge;
      attempt.status = 'submitted';
      attempt.submittedAt = new Date();
      await attempt.save();

      // Notify student of instant results
      await Notification.create({
        user: req.user._id,
        title: 'Test Result Declared',
        message: `Your results for MCQ test "${test.name}" are ready. Score: ${score}/${test.totalMarks} (${badge.toUpperCase()} Badge).`,
        type: 'result_released',
      });

      res.json({ message: 'MCQ test submitted successfully', attempt });
    } else {
      res.status(400);
      throw new Error('To submit subjective tests, upload your PDF file');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Submit subjective PDF answer file (Student)
 * @route POST /api/attempts/test/:testId/submit-subjective
 */
export const submitSubjectivePDF = async (req, res, next) => {
  try {
    const testId = req.params.testId;
    const test = await Test.findById(testId);
    if (!test || test.type !== 'subjective') {
      res.status(400);
      throw new Error('Invalid test or not subjective');
    }

    if (!req.file) {
      res.status(400);
      throw new Error('No PDF file uploaded');
    }

    let attempt = await Attempt.findOne({ student: req.user._id, test: testId });
    if (!attempt) {
      // Auto create attempt if they just open and upload
      attempt = new Attempt({
        student: req.user._id,
        test: testId,
        type: 'subjective',
        startTime: new Date(),
      });
    }

    if (attempt.status !== 'started' && attempt.status !== 'submitted') {
      res.status(400);
      throw new Error('You cannot upload answers to graded tests');
    }

    // Upload student answer PDF to Cloudinary (using 'raw' file type for PDFs)
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'student_submissions', 'raw');

    attempt.subjectiveAnswerUrl = uploadResult.secure_url;
    attempt.status = 'submitted';
    attempt.submittedAt = new Date();
    await attempt.save();

    res.json({ message: 'Answer PDF uploaded successfully', attempt });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get subjective/MCQ test submissions for grading (Admin)
 * @route GET /api/attempts/test/:testId/evaluation
 */
export const getSubjectiveSubmissions = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    const submissions = await Attempt.find({ test: test._id })
      .populate('student', 'name email avatar')
      .sort({ submittedAt: 1 });

    res.json(submissions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete student test attempt (Admin)
 * @route DELETE /api/attempts/:id
 */
export const deleteAttempt = async (req, res, next) => {
  try {
    const attempt = await Attempt.findById(req.params.id);
    if (!attempt) {
      res.status(404);
      throw new Error('Attempt not found');
    }

    if (attempt.subjectiveAnswerUrl) {
      await deleteFromCloudinary(attempt.subjectiveAnswerUrl, 'raw');
    }
    if (attempt.subjectiveCheckedUrl) {
      await deleteFromCloudinary(attempt.subjectiveCheckedUrl, 'raw');
    }

    await attempt.deleteOne();
    res.json({ message: 'Attempt deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete all attempts for a test (Admin)
 * @route DELETE /api/attempts/test/:testId/all
 */
export const deleteAllAttemptsForTest = async (req, res, next) => {
  try {
    const testId = req.params.testId;
    const attempts = await Attempt.find({ test: testId });

    for (const attempt of attempts) {
      if (attempt.subjectiveAnswerUrl) {
        await deleteFromCloudinary(attempt.subjectiveAnswerUrl, 'raw');
      }
      if (attempt.subjectiveCheckedUrl) {
        await deleteFromCloudinary(attempt.subjectiveCheckedUrl, 'raw');
      }
    }

    await Attempt.deleteMany({ test: testId });
    res.json({ message: 'All attempts for this test have been deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Grade subjective attempt & save annotations (Admin)
 * @route POST /api/attempts/:id/grade
 */
export const gradeSubjectiveAttempt = async (req, res, next) => {
  try {
    const { marksObtained, annotations, subjectiveCheckedUrl } = req.body;
    const attempt = await Attempt.findById(req.params.id).populate('test student');

    if (!attempt) {
      res.status(404);
      throw new Error('Attempt not found');
    }

    const test = attempt.test;
    const marks = Number(marksObtained);

    if (isNaN(marks) || marks < 0 || marks > test.totalMarks) {
      res.status(400);
      throw new Error(`Marks must be between 0 and ${test.totalMarks}`);
    }

    // Calculate Badge
    const percent = (marks / test.totalMarks) * 100;
    let badge = 'none';
    if (percent === 100) badge = 'gold';
    else if (percent >= 90) badge = 'silver';

    attempt.marksObtained = marks;
    attempt.annotations = annotations || attempt.annotations;
    if (subjectiveCheckedUrl) {
      attempt.subjectiveCheckedUrl = subjectiveCheckedUrl;
    }
    attempt.badge = badge;
    attempt.status = 'graded';
    attempt.gradedAt = new Date();
    await attempt.save();

    // Notify student
    await Notification.create({
      user: attempt.student._id,
      title: 'Subjective Test Graded',
      message: `Your subjective test "${test.name}" has been graded. Score: ${marks}/${test.totalMarks} (${badge.toUpperCase()} Badge).`,
      type: 'result_released',
    });

    res.json({ message: 'Subjective test graded successfully', attempt });
  } catch (error) {
    next(error);
  }
};

/**
 * Auto submit helper for MCQ when time runs out
 */
const autoSubmitMCQ = async (attempt, test, res) => {
  const questions = await Question.find({ test: attempt.test });
  let score = 0;

  questions.forEach((q) => {
    const studentAns = attempt.answers.get(q._id.toString());
    if (studentAns !== undefined && studentAns !== null) {
      if (Number(studentAns) === q.correctAnswer) {
        score += q.marks;
      } else {
        if (test.negativeMarking) {
          score -= q.negativeMarks;
        }
      }
    }
  });

  const percent = (score / test.totalMarks) * 100;
  let badge = 'none';
  if (percent === 100) badge = 'gold';
  else if (percent >= 90) badge = 'silver';

  attempt.marksObtained = score;
  attempt.badge = badge;
  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  await attempt.save();

  await Notification.create({
    user: attempt.student,
    title: 'Test Auto-Submitted',
    message: `Your test "${test.name}" was auto-submitted due to timer expiration. Score: ${score}/${test.totalMarks}.`,
    type: 'result_released',
  });

  return res.json({
    message: 'Time expired! Test auto-submitted.',
    attempt,
  });
};

/**
 * Helper to fetch HTTP/HTTPS resource and follow redirects recursively
 */
const fetchWithRedirects = (url, headers = {}, depth = 0) => {
  return new Promise((resolve, reject) => {
    if (depth > 5) {
      return reject(new Error('Too many redirects'));
    }
    const client = url.startsWith('https') ? https : http;
    const requestOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      }
    };

    client.get(url, requestOptions, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let redirectUrl = response.headers.location;
        if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
          const parsedUrl = new URL(url);
          redirectUrl = new URL(redirectUrl, parsedUrl.origin).href;
        }
        return fetchWithRedirects(redirectUrl, headers, depth + 1).then(resolve).catch(reject);
      }
      resolve(response);
    }).on('error', reject);
  });
};

/**
 * @desc Proxy subjective PDF download to bypass CORS
 * @route GET /api/attempts/proxy-pdf?url=...
 */
export const proxyPDF = async (req, res, next) => {
  try {
    let pdfUrl = req.query.url;
    if (!pdfUrl) {
      res.status(400);
      throw new Error('URL query parameter is required');
    }

    // Decode URL from base64 if it does not start with http:// or https:// (backward compatible)
    if (!pdfUrl.startsWith('http://') && !pdfUrl.startsWith('https://')) {
      try {
        pdfUrl = Buffer.from(pdfUrl, 'base64').toString('utf-8');
      } catch (err) {
        res.status(400);
        throw new Error('Invalid encoded URL');
      }
    }

    if (!pdfUrl.startsWith('https://res.cloudinary.com/') && !pdfUrl.startsWith('http://res.cloudinary.com/')) {
      res.status(400);
      throw new Error('Invalid URL source');
    }

    fetchWithRedirects(pdfUrl)
      .then((pdfResponse) => {
        if (pdfResponse.statusCode !== 200) {
          return res.status(pdfResponse.statusCode || 500).json({
            message: `Failed to fetch PDF: Status ${pdfResponse.statusCode}`
          });
        }

        res.setHeader('Content-Type', 'application/pdf');
        if (pdfResponse.headers['content-length']) {
          res.setHeader('Content-Length', pdfResponse.headers['content-length']);
        }
        if (req.query.download === 'true') {
          const rawFilename = req.query.filename || 'question_paper.pdf';
          const sanitizedFilename = rawFilename.replace(/[^a-zA-Z0-9_.-]/g, '_');
          res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
        } else {
          res.setHeader('Content-Disposition', 'inline; filename="answer.pdf"');
        }
        pdfResponse.pipe(res);
      })
      .catch((err) => {
        console.error('PDF proxy error:', err);
        res.status(500).json({ message: err.message });
      });
  } catch (error) {
    next(error);
  }
};
