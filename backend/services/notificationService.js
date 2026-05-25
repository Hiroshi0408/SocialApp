const notificationDAO = require("../dao/notificationDAO");
const commentDAO = require("../dao/commentDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { getIO } = require("../config/socket");
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("../constants");

class NotificationService {
  _getId(value) {
    if (!value) return null;
    const raw = value._id || value.id || value;
    const stringValue = raw.toString?.();
    return stringValue && stringValue !== "[object Object]"
      ? stringValue
      : raw;
  }

  // Format notification cho client (thêm sender alias + timestamp)
  _format(notification) {
    const notificationId = this._getId(notification._id || notification.id);
    const targetId = this._getId(notification.targetId);
    const postId = this._getId(
      notification.postId || notification.targetId?.postId,
    );

    return {
      ...notification,
      _id: notificationId,
      id: notificationId,
      targetId,
      postId,
      sender: notification.senderId,
      timestamp: getTimeAgo(notification.createdAt),
    };
  }

  async _resolveCommentPostId(targetId) {
    if (!targetId) return null;

    const comment = await commentDAO.findById(targetId, {
      select: "postId",
      lean: true,
      includeDeleted: true,
    });

    return comment?.postId || null;
  }

  async _attachCommentPostIds(notifications) {
    const commentIds = [
      ...new Set(
        notifications
          .filter((notification) => (
            notification.targetType === "comment" &&
            !notification.postId &&
            notification.targetId
          ))
          .map((notification) => this._getId(notification.targetId).toString()),
      ),
    ];

    if (commentIds.length === 0) return notifications;

    const comments = await commentDAO.findMany(
      { _id: { $in: commentIds } },
      {
        select: "postId",
        lean: true,
        includeDeleted: true,
        limit: commentIds.length,
      },
    );
    const postIdByCommentId = new Map(
      comments.map((comment) => [
        comment._id.toString(),
        comment.postId,
      ]),
    );

    return notifications.map((notification) => {
      if (
        notification.targetType !== "comment" ||
        notification.postId ||
        !notification.targetId
      ) {
        return notification;
      }

      const commentId = this._getId(notification.targetId).toString();
      const postId = postIdByCommentId.get(commentId);
      return postId ? { ...notification, postId } : notification;
    });
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
    const notificationsWithPostIds =
      await this._attachCommentPostIds(notifications);

    return {
      notifications: notificationsWithPostIds.map((notification) =>
        this._format(notification),
      ),
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
    let { postId } = data;

    // Không tạo self-notification — TRỪ type "auto_post":
    // post do hệ thống tạo thay org owner, owner cần được noti để review/edit
    // (kickoff post được tạo ngay sau khi chính owner ký tx createCampaign nên
    // sender = recipient = owner; vẫn cần noti có ý nghĩa).
    if (
      recipientId.toString() === senderId.toString() &&
      type !== "auto_post"
    ) {
      return;
    }

    let notification;
    try {
      if (!postId && targetType === "comment") {
        postId = await this._resolveCommentPostId(targetId);
      }

      notification = await notificationDAO.create({
        recipientId,
        senderId,
        type,
        targetType,
        targetId,
        postId,
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
