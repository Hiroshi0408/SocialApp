const notificationDAO = require("../dao/notificationDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { getIO } = require("../config/socket");
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("../constants");

class NotificationService {
  // Format notification cho client (thêm sender alias + timestamp)
  _format(notification) {
    return {
      ...notification,
      sender: notification.senderId,
      timestamp: getTimeAgo(notification.createdAt),
    };
  }

  async getNotifications(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      notificationDAO.findByUser(userId, { skip, limit }),
      notificationDAO.countByUser(userId),
      notificationDAO.countUnread(userId),
    ]);

    return {
      notifications: notifications.map(this._format),
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + notifications.length < total,
      },
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await notificationDAO.markAsRead(notificationId, userId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }
  }

  async markAllAsRead(userId) {
    await notificationDAO.markAllAsRead(userId);
  }

  async getUnreadCount(userId) {
    return await notificationDAO.countUnread(userId);
  }

  async deleteNotification(notificationId, userId) {
    const notification = await notificationDAO.deleteById(notificationId, userId);

    if (!notification) {
      throw new AppError("Notification not found", 404);
    }
  }

  // Tạo notification và push realtime qua socket — được gọi từ các service khác
  async createNotification(data) {
    const { recipientId, senderId, type, targetType, targetId, text } = data;

    // Không tạo self-notification
    if (recipientId.toString() === senderId.toString()) {
      return;
    }

    let notification;
    try {
      notification = await notificationDAO.create({
        recipientId,
        senderId,
        type,
        targetType,
        targetId,
        text: text || "",
      });
    } catch (error) {
      // Bỏ qua duplicate notification (unique index)
      if (error.code === 11000) {
        logger.info("Duplicate notification ignored");
        return;
      }
      throw error;
    }

    await notification.populate("senderId", "username fullName avatar");
    await notification.populate({
      path: "targetId",
      select: "image caption username fullName",
    });

    const formatted = this._format(notification.toObject());

    try {
      const io = getIO();
      io.to(`user:${recipientId}`).emit("notification:new", {
        notification: formatted,
      });
      logger.info(`Notification sent - Type: ${type}, Recipient: ${recipientId}`);
    } catch (socketError) {
      // Socket lỗi không nên làm hỏng flow chính
      logger.error("Socket emit error:", socketError.message);
    }

    logger.info(`Notification created - Type: ${type}, Recipient: ${recipientId}`);
    return notification;
  }
}

module.exports = new NotificationService();
