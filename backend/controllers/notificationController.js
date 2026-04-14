const notificationService = require("../services/notificationService");
const logger = require("../utils/logger");

// [GET] /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    logger.info(`Get notifications - User: ${req.user.username}`);
    const result = await notificationService.getNotifications(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/notifications/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
};

// [PUT] /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

// [PUT] /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user.id);
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};
