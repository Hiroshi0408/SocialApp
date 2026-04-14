const Notification = require("../models/Notification");

class NotificationDAO {
  async create(data) {
    const notification = new Notification(data);
    return await notification.save();
  }

  async findByUser(userId, options = {}) {
    const { skip = 0, limit = 20 } = options;

    return await Notification.find({ recipientId: userId })
      .populate("senderId", "username fullName avatar")
      .populate({
        path: "targetId",
        select: "image caption username fullName",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countByUser(userId) {
    return await Notification.countDocuments({ recipientId: userId });
  }

  async markAsRead(notificationId, userId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: userId },
      { read: true },
      { new: true }
    );
  }

  async markAllAsRead(userId) {
    return await Notification.updateMany(
      { recipientId: userId, read: false },
      { read: true }
    );
  }

  async countUnread(userId) {
    return await Notification.countDocuments({
      recipientId: userId,
      read: false,
    });
  }

  async deleteById(notificationId, userId) {
    return await Notification.findOneAndDelete({
      _id: notificationId,
      recipientId: userId,
    });
  }

  async deleteOne(filter) {
    return await Notification.findOneAndDelete(filter);
  }

  async deleteMany(filter) {
    return await Notification.deleteMany(filter);
  }
}

module.exports = new NotificationDAO();
