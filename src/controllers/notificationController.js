import Notification from '../models/Notification.js';

/**
 * @desc Get user notifications
 * @route GET /api/notifications
 */
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50); // Keep payload small
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark notification as read
 * @route PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    notification.read = true;
    await notification.save();

    res.json(notification);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Mark all notifications as read
 * @route PUT /api/notifications/read-all
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Delete individual notification
 * @route DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      res.status(404);
      throw new Error('Notification not found');
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc Clear all notifications for the user
 * @route DELETE /api/notifications/clear-all
 */
export const clearAllNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared successfully' });
  } catch (error) {
    next(error);
  }
};
