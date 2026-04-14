const Conversation = require("../models/Conversation");

class ConversationDAO {
  async findById(id, userId) {
    return await Conversation.findOne({ _id: id, participants: userId });
  }

  // Tìm conversation 1-1 giữa 2 user (dùng static method của model)
  async findBetweenUsers(userId1, userId2) {
    return await Conversation.findBetweenUsers(userId1, userId2);
  }

  async create(data) {
    return await Conversation.create(data);
  }

  async findWithPopulatedById(id) {
    return await Conversation.findById(id)
      .populate("participants", "username avatar fullName")
      .lean();
  }

  async findByUser(userId) {
    return await Conversation.find({ participants: userId })
      .populate("participants", "_id username avatar fullName")
      .populate({
        path: "lastMessage",
        select: "content sender createdAt read messageType isEncrypted",
      })
      .sort({ lastMessageAt: -1 })
      .lean();
  }

  // Cập nhật lastMessage + lastMessageAt sau khi gửi tin
  async updateLastMessage(conversationId, messageId, sentAt) {
    return await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessage: messageId, lastMessageAt: sentAt },
      { new: true }
    );
  }

  // Tăng unreadCount cho participant
  async incrementUnread(conversation, recipientId) {
    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    const current = conversation.unreadCount.get(recipientId.toString()) || 0;
    conversation.unreadCount.set(recipientId.toString(), current + 1);
    return await conversation.save();
  }

  // Reset unreadCount về 0 cho userId khi mark as read
  async resetUnread(conversation, userId) {
    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    conversation.unreadCount.set(userId.toString(), 0);
    return await conversation.save();
  }
}

module.exports = new ConversationDAO();
