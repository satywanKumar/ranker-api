import Event from '../models/Event.js';
import Batch from '../models/Batch.js';

/**
 * @desc Get all events for a batch
 * @route GET /api/events
 */
export const getEvents = async (req, res, next) => {
  try {
    let batchId;

    if (req.user.role === 'admin') {
      batchId = req.query.batchId;
      if (!batchId) {
        res.status(400);
        throw new Error('Batch ID is required');
      }
    } else {
      // Student gets their own batch events
      batchId = req.user.batch;
      if (!batchId) {
        return res.json([]); // Return empty list if student is not assigned a batch
      }
    }

    const events = await Event.find({ batch: batchId }).sort({ date: 1 });
    res.json(events);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Create a new event for a batch
 * @route POST /api/events
 */
export const createEvent = async (req, res, next) => {
  try {
    const { title, description, date, batchId } = req.body;

    if (!title || !date || !batchId) {
      res.status(400);
      throw new Error('Title, date, and batchId are required');
    }

    // Verify batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      res.status(404);
      throw new Error('Batch not found');
    }

    const event = await Event.create({
      title,
      description: description || '',
      date,
      batch: batchId,
    });

    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete a batch event
 * @route DELETE /api/events/:id
 */
export const deleteEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);

    if (!event) {
      res.status(404);
      throw new Error('Event not found');
    }

    await event.deleteOne();
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    next(error);
  }
};
