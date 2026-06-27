import Test from '../models/Test.js';
import Question from '../models/Question.js';
import CodingQuestion from '../models/CodingQuestion.js';
import Attempt from '../models/Attempt.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

/**
 * @desc Get all tests
 * @route GET /api/tests
 */
export const getTests = async (req, res, next) => {
  try {
    let tests;
    if (req.user.role === 'admin') {
      tests = await Test.find({}).populate('batch', 'name').sort({ createdAt: -1 });
    } else {
      if (!req.user.batch) {
        return res.json([]); // No batch assigned
      }
      tests = await Test.find({ batch: req.user.batch, status: 'published' }).sort({ createdAt: -1 });
    }

    // Attach student attempt status for UI context
    const testIds = tests.map(t => t._id);
    const attempts = await Attempt.find({ student: req.user._id, test: { $in: testIds } });
    
    const attemptsMap = {};
    attempts.forEach(att => {
      attemptsMap[att.test.toString()] = {
        status: att.status,
        marksObtained: att.marksObtained,
        badge: att.badge,
        attemptId: att._id,
      };
    });

    const testsWithAttempt = tests.map(test => {
      const testObj = test.toObject();
      testObj.attempt = attemptsMap[test._id.toString()] || null;
      return testObj;
    });

    res.json(testsWithAttempt);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get single test with questions
 * @route GET /api/tests/:id
 */
export const getTestById = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id).populate('batch', 'name');
    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    // If student, check if batch matches
    if (req.user.role !== 'admin' && test.batch._id.toString() !== req.user.batch?.toString()) {
      res.status(403);
      throw new Error('Unauthorized access to this test');
    }

    // Retrieve questions sorted by order depending on test type
    let questions = [];
    if (test.type === 'coding') {
      questions = await CodingQuestion.find({ test: test._id }).sort({ order: 1 });
      
      // SECURITY CHECK: Strip hidden test cases for students
      if (req.user.role !== 'admin') {
        questions = questions.map((q) => {
          const qObj = q.toObject();
          delete qObj.hiddenTestCases; // Hide hidden test cases from API payload
          return qObj;
        });
      }
    } else {
      questions = await Question.find({ test: test._id }).sort({ order: 1 });

      // SECURITY CHECK: Strip correct answers if user is student and test is ongoing/unsubmitted
      if (req.user.role !== 'admin') {
        const attempt = await Attempt.findOne({ student: req.user._id, test: test._id });
        const isCompleted = attempt && (attempt.status === 'submitted' || attempt.status === 'graded');
        
        if (!isCompleted) {
          questions = questions.map((q) => {
            const qObj = q.toObject();
            delete qObj.correctAnswer; // Remove answers from API payload
            return qObj;
          });
        }
      }
    }

    res.json({ test, questions });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create a new test
 * @route POST /api/tests
 */
export const createTest = async (req, res, next) => {
  try {
    const {
      name,
      description,
      duration,
      validTill,
      totalMarks,
      negativeMarking,
      type,
      batch,
      deadline,
      questionPaperUrl,
      startDate,
      passingMarks,
      instructions,
    } = req.body;

    const test = await Test.create({
      name,
      description,
      duration,
      validTill,
      totalMarks,
      negativeMarking: negativeMarking === 'true' || negativeMarking === true,
      type,
      batch,
      deadline: deadline || null,
      questionPaperUrl: type === 'subjective' ? questionPaperUrl : undefined,
      startDate: startDate || new Date(),
      passingMarks: Number(passingMarks) || 0,
      instructions: instructions || '',
    });

    res.status(201).json(test);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update a test details
 * @route PUT /api/tests/:id
 */
export const updateTest = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    const wasDraft = test.status === 'draft';

    test.name = req.body.name || test.name;
    test.description = req.body.description !== undefined ? req.body.description : test.description;
    test.duration = req.body.duration || test.duration;
    test.validTill = req.body.validTill || test.validTill;
    test.totalMarks = req.body.totalMarks || test.totalMarks;
    test.negativeMarking = req.body.negativeMarking !== undefined ? req.body.negativeMarking : test.negativeMarking;
    test.status = req.body.status || test.status;
    test.deadline = req.body.deadline || test.deadline;
    
    // Coding fields
    if (req.body.startDate !== undefined) test.startDate = req.body.startDate;
    if (req.body.passingMarks !== undefined) test.passingMarks = req.body.passingMarks;
    if (req.body.instructions !== undefined) test.instructions = req.body.instructions;

    if (test.type === 'subjective' && req.body.questionPaperUrl) {
      test.questionPaperUrl = req.body.questionPaperUrl;
    }

    const updatedTest = await test.save();

    // If changing from draft to published, notify batch students
    if (wasDraft && updatedTest.status === 'published') {
      const students = await User.find({ batch: test.batch, status: 'approved' });
      const notifications = students.map((std) => ({
        user: std._id,
        title: 'New Test Published',
        message: `A new ${test.type.toUpperCase()} test "${test.name}" is now available. Complete it before ${new Date(test.validTill).toLocaleDateString()}.`,
        type: 'test_published',
      }));
      await Notification.insertMany(notifications);
    }

    res.json(updatedBatchContext(updatedTest));
  } catch (error) {
    next(error);
  }
};

// Helper helper
const updatedBatchContext = async (test) => {
  return await Test.findById(test._id).populate('batch', 'name');
};

/**
 * @desc Delete test
 * @route DELETE /api/tests/:id
 */
export const deleteTest = async (req, res, next) => {
  try {
    const test = await Test.findById(req.params.id);

    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    // 1. Delete test question paper PDF if it exists
    if (test.type === 'subjective' && test.questionPaperUrl) {
      await deleteFromCloudinary(test.questionPaperUrl, 'raw');
    }

    // 2. Fetch and delete questions' images from Cloudinary
    const questions = await Question.find({ test: test._id });
    for (const q of questions) {
      if (q.imageUrl) {
        await deleteFromCloudinary(q.imageUrl, 'image');
      }
    }

    // 3. Fetch and delete attempts' submission and checked files from Cloudinary
    const attempts = await Attempt.find({ test: test._id });
    for (const attempt of attempts) {
      if (attempt.subjectiveAnswerUrl) {
        await deleteFromCloudinary(attempt.subjectiveAnswerUrl, 'raw');
      }
      if (attempt.subjectiveCheckedUrl) {
        await deleteFromCloudinary(attempt.subjectiveCheckedUrl, 'raw');
      }
    }

    // Remove questions & attempts associated with test
    await Question.deleteMany({ test: test._id });
    await Attempt.deleteMany({ test: test._id });

    await test.deleteOne();
    res.json({ message: 'Test and associated data removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Duplicate a test and all its questions
 * @route POST /api/tests/:id/duplicate
 */
export const duplicateTest = async (req, res, next) => {
  try {
    const originalTest = await Test.findById(req.params.id);
    if (!originalTest) {
      res.status(404);
      throw new Error('Test to duplicate not found');
    }

    // Create duplicated test object as draft
    const duplicatedTest = await Test.create({
      name: `${originalTest.name} (Copy)`,
      description: originalTest.description,
      duration: originalTest.duration,
      validTill: originalTest.validTill,
      totalMarks: originalTest.totalMarks,
      negativeMarking: originalTest.negativeMarking,
      type: originalTest.type,
      batch: originalTest.batch,
      questionPaperUrl: originalTest.questionPaperUrl,
      deadline: originalTest.deadline,
      status: 'draft',
    });

    // Duplicate questions
    const originalQuestions = await Question.find({ test: originalTest._id }).sort({ order: 1 });
    const duplicatedQuestions = originalQuestions.map((q) => ({
      test: duplicatedTest._id,
      imageUrl: q.imageUrl,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      order: q.order,
    }));

    if (duplicatedQuestions.length > 0) {
      await Question.insertMany(duplicatedQuestions);
    }

    res.status(201).json(duplicatedTest);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Upload subjective PDF question paper
 * @route POST /api/tests/upload-paper
 */
export const uploadQuestionPaper = async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('No PDF file uploaded');
    }

    const uploadResult = await uploadToCloudinary(req.file.buffer, 'question_papers', 'raw');
    res.json({ url: uploadResult.secure_url });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// QUESTION CONTROLLER METHODS
// ==========================================

/**
 * @desc Add a question
 * @route POST /api/tests/:id/questions
 */
export const addQuestion = async (req, res, next) => {
  try {
    const { questionText, imageUrl, options, correctAnswer, marks, negativeMarks } = req.body;
    const testId = req.params.id;

    const test = await Test.findById(testId);
    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    // Get highest current order
    const lastQuestion = await Question.findOne({ test: testId }).sort({ order: -1 });
    const order = lastQuestion ? lastQuestion.order + 1 : 0;

    const question = await Question.create({
      test: testId,
      questionText: questionText || '',
      imageUrl: imageUrl || '',
      options,
      correctAnswer,
      marks: Number(marks) || 4,
      negativeMarks: Number(negativeMarks) || 1,
      order,
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update a question
 * @route PUT /api/tests/:id/questions/:questionId
 */
export const updateQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    question.questionText = req.body.questionText !== undefined ? req.body.questionText : question.questionText;
    question.imageUrl = req.body.imageUrl !== undefined ? req.body.imageUrl : question.imageUrl;
    question.options = req.body.options || question.options;
    question.correctAnswer = req.body.correctAnswer !== undefined ? req.body.correctAnswer : question.correctAnswer;
    question.marks = req.body.marks !== undefined ? Number(req.body.marks) : question.marks;
    question.negativeMarks = req.body.negativeMarks !== undefined ? Number(req.body.negativeMarks) : question.negativeMarks;

    const updatedQuestion = await question.save();
    res.json(updatedQuestion);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a question
 * @route DELETE /api/tests/:id/questions/:questionId
 */
export const deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.questionId);
    if (!question) {
      res.status(404);
      throw new Error('Question not found');
    }

    if (question.imageUrl) {
      await deleteFromCloudinary(question.imageUrl, 'image');
    }

    await question.deleteOne();
    res.json({ message: 'Question removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Reorder all questions in a test
 * @route PUT /api/tests/:id/questions/reorder
 */
export const reorderQuestions = async (req, res, next) => {
  try {
    const { questionIds } = req.body; // array of question IDs in new order
    if (!Array.isArray(questionIds)) {
      res.status(400);
      throw new Error('questionIds array is required');
    }

    const bulkOps = questionIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, test: req.params.id },
        update: { order: index },
      },
    }));

    await Question.bulkWrite(bulkOps);
    res.json({ message: 'Questions reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Duplicate a single question within a test
 * @route POST /api/tests/:id/questions/:questionId/duplicate
 */
export const duplicateQuestion = async (req, res, next) => {
  try {
    const original = await Question.findById(req.params.questionId);
    if (!original) {
      res.status(404);
      throw new Error('Question to duplicate not found');
    }

    const question = await Question.create({
      test: original.test,
      questionText: `${original.questionText} (Copy)`,
      imageUrl: original.imageUrl,
      options: original.options,
      correctAnswer: original.correctAnswer,
      marks: original.marks,
      negativeMarks: original.negativeMarks,
      order: original.order + 1, // Will insert next to it
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Get all coding questions for a test
 * @route GET /api/tests/:id/coding-questions
 */
export const getCodingQuestionsByTest = async (req, res, next) => {
  try {
    const testId = req.params.id;
    const questions = await CodingQuestion.find({ test: testId }).sort({ order: 1 });
    res.json(questions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Add a coding question
 * @route POST /api/tests/:id/coding-questions
 */
export const addCodingQuestion = async (req, res, next) => {
  try {
    const testId = req.params.id;
    const {
      title,
      problemStatement,
      constraints,
      inputFormat,
      outputFormat,
      sampleInput,
      sampleOutput,
      explanation,
      difficulty,
      marks,
      hiddenTestCases,
      visibleTestCases,
      questionType,
      supportedLanguages,
      starterCode,
    } = req.body;

    const test = await Test.findById(testId);
    if (!test) {
      res.status(404);
      throw new Error('Test not found');
    }

    const lastQuestion = await CodingQuestion.findOne({ test: testId }).sort({ order: -1 });
    const order = lastQuestion ? lastQuestion.order + 1 : 0;

    const question = await CodingQuestion.create({
      test: testId,
      title: title || 'New Coding Problem',
      problemStatement: problemStatement || 'Problem statement here...',
      constraints: constraints || '',
      inputFormat: inputFormat || '',
      outputFormat: outputFormat || '',
      sampleInput: sampleInput || '',
      sampleOutput: sampleOutput || '',
      explanation: explanation || '',
      difficulty: difficulty || 'Medium',
      marks: Number(marks) || 10,
      hiddenTestCases: hiddenTestCases || [],
      visibleTestCases: visibleTestCases || [],
      questionType: questionType || 'Code Writing',
      supportedLanguages: supportedLanguages || ['javascript', 'python', 'c', 'cpp', 'java'],
      starterCode: starterCode || {},
      order,
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Update a coding question
 * @route PUT /api/tests/:id/coding-questions/:questionId
 */
export const updateCodingQuestion = async (req, res, next) => {
  try {
    const question = await CodingQuestion.findById(req.params.questionId);
    if (!question) {
      res.status(404);
      throw new Error('Coding question not found');
    }

    const fields = [
      'title',
      'problemStatement',
      'constraints',
      'inputFormat',
      'outputFormat',
      'sampleInput',
      'sampleOutput',
      'explanation',
      'difficulty',
      'marks',
      'hiddenTestCases',
      'visibleTestCases',
      'questionType',
      'supportedLanguages',
      'starterCode',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field];
      }
    });

    const updated = await question.save();
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a coding question
 * @route DELETE /api/tests/:id/coding-questions/:questionId
 */
export const deleteCodingQuestion = async (req, res, next) => {
  try {
    const question = await CodingQuestion.findById(req.params.questionId);
    if (!question) {
      res.status(404);
      throw new Error('Coding question not found');
    }

    await question.deleteOne();
    res.json({ message: 'Coding question removed successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Reorder coding questions
 * @route PUT /api/tests/:id/coding-questions/reorder
 */
export const reorderCodingQuestions = async (req, res, next) => {
  try {
    const { questionIds } = req.body;
    if (!Array.isArray(questionIds)) {
      res.status(400);
      throw new Error('questionIds array is required');
    }

    const bulkOps = questionIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id, test: req.params.id },
        update: { order: index },
      },
    }));

    await CodingQuestion.bulkWrite(bulkOps);
    res.json({ message: 'Coding questions reordered successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Duplicate a coding question
 * @route POST /api/tests/:id/coding-questions/:questionId/duplicate
 */
export const duplicateCodingQuestion = async (req, res, next) => {
  try {
    const original = await CodingQuestion.findById(req.params.questionId);
    if (!original) {
      res.status(404);
      throw new Error('Coding question to duplicate not found');
    }

    const question = await CodingQuestion.create({
      test: original.test,
      title: `${original.title} (Copy)`,
      problemStatement: original.problemStatement,
      constraints: original.constraints,
      inputFormat: original.inputFormat,
      outputFormat: original.outputFormat,
      sampleInput: original.sampleInput,
      sampleOutput: original.sampleOutput,
      explanation: original.explanation,
      difficulty: original.difficulty,
      marks: original.marks,
      hiddenTestCases: original.hiddenTestCases,
      visibleTestCases: original.visibleTestCases,
      questionType: original.questionType,
      supportedLanguages: original.supportedLanguages,
      starterCode: original.starterCode || {},
      order: original.order + 1,
    });

    res.status(201).json(question);
  } catch (error) {
    next(error);
  }
};
