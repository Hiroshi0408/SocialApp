const Conversation = require("../models/Conversation");

class ConversationDAO {
  async findById(id, userId) {
    return await Conversation.findOne({ _id: id, participants: userId });
  }

  // Tìm conversation 1-1 giữa 2 user
  async findBetweenUsers(userId1, userId2) {
    return await Conversation.findOne({
      type: "direct",
      participants: { $all: [userId1, userId2] },
    })
      .populate("participants", "username avatar fullName")
      .populate({ path: "lastMessage", select: "content sender createdAt read" });
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

  // Tăng unreadCount cho recipient — atomic, tránh race condition
  async incrementUnread(conversationId, recipientId) {
    return await Conversation.findByIdAndUpdate(conversationId, {
      $inc: { [`unreadCount.${recipientId}`]: 1 },
    });
  }

  // Reset unreadCount về 0 cho userId khi mark as read — atomic
  async resetUnread(conversationId, userId) {
    return await Conversation.findByIdAndUpdate(conversationId, {
      $set: { [`unreadCount.${userId}`]: 0 },
    });
  }
}

module.exports = new ConversationDAO();
