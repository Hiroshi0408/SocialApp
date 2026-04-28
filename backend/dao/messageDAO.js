const Message = require("../models/Message");

class MessageDAO {
  async findByConversation(conversationId, options = {}) {
    const { skip = 0, limit = 50 } = options;

    return await Message.find({ conversationId, deleted: false })
      .populate("sender", "username avatar fullName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async count(conversationId) {
    return await Message.countDocuments({ conversationId, deleted: false });
  }

  async create(data) {
    return await Message.create(data);
  }

  // Mark tất cả tin nhắn chưa đọc (không phải của userId) là đã đọc
  async markAsRead(conversationId, userId) {
    return await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        read: false,
      },
      { $set: { read: true, readAt: new Date() } }
    );
  }
}

module.exports = new MessageDAO();
