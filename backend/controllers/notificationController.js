const Notification = require("../models/Notification");
const { getTimeAgo } = require("../utils/timeHelper");
const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require("../constants");
const { getIO } = require("../config/socket");

// [GET] /api/notifications - Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );
    const skip = (page - 1) * limit;

    console.log(`Get notifications - User: ${req.user.username}`);

    const notifications = await Notification.find({ recipientId: userId })
      .populate("senderId", "username fullName avatar")
      .populate({
        path: "targetId",
        select: "image caption username fullName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedNotifications = notifications.map((notification) => ({
      ...notification,
      sender: notification.senderId,
      timestamp: getTimeAgo(notification.createdAt),
    }));

    const total = await Notification.countDocuments({ recipientId: userId });
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      read: false,
    });

    res.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + formattedNotifications.length < total,
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PUT] /api/notifications/:id/read - Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PUT] /api/notifications/read-all - Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany({ recipientId: userId, read: false }, { read: true });

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark all as read",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [DELETE] /api/notifications/:id - Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipientId: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Delete notification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/notifications/unread-count - Get unread count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await Notification.countDocuments({
      recipientId: userId,
      read: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Get unread count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to create notification
exports.createNotification = async (data) => {
  try {
    const { recipientId, senderId, type, targetType, targetId, text } = data;

    if (recipientId.toString() === senderId.toString()) {
      return;
    }

    const notification = new Notification({
      recipientId,
      senderId,
      type,
      targetType,
      targetId,
      text: text || "",
    });

    await notification.save();

    await notification.populate("senderId", "username fullName avatar");
    await notification.populate({
      path: "targetId",
      select: "image caption username fullName",
    });

    const formattedNotification = {
      ...notification.toObject(),
      sender: notification.senderId,
      timestamp: getTimeAgo(notification.createdAt),
    };

    try {
      const io = getIO();
      io.to(`user:${recipientId}`).emit("notification:new", {
        notification: formattedNotification,
      });
      console.log(`Notification sent - Type: ${type}, Recipient: ${recipientId}`);
    } catch (socketError) {
      console.error("Socket emit error:", socketError.message);
    }

    console.log(`Notification created - Type: ${type}, Recipient: ${recipientId}`);
  } catch (error) {
    if (error.code === 11000) {
      console.log("Duplicate notification ignored");
      return;
    }
    console.error("Create notification error:", error);
  }
};
