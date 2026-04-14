const conversationDAO = require("../dao/conversationDAO");
const messageDAO = require("../dao/messageDAO");
const userDAO = require("../dao/userDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getIO } = require("../config/socket");

// TODO: Thay bằng friendDAO khi muốn dọn tiếp
const Friendship = require("../models/Friendship");

class ChatService {
  async getConversations(userId) {
    const [friendships, conversations] = await Promise.all([
      Friendship.find({ $or: [{ userA: userId }, { userB: userId }] }).select("userA userB").lean(),
      conversationDAO.findByUser(userId),
    ]);

    const friendIdSet = new Set(
      friendships.map((f) => {
        const a = f.userA.toString();
        const b = f.userB.toString();
        return a === userId.toString() ? b : a;
      })
    );

    const formattedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants.find((p) => p._id.toString() !== userId.toString());

      const isFriendConversation =
        conv.type === "group" || (otherParticipant ? friendIdSet.has(otherParticipant._id.toString()) : false);

      return {
        _id: conv._id,
        participant: otherParticipant,
        type: conv.type,
        isFriendConversation,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount: conv.unreadCount?.[userId] || 0,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    return {
      conversations: formattedConversations,
      friendConversations: formattedConversations.filter((c) => c.isFriendConversation),
      pendingConversations: formattedConversations.filter((c) => !c.isFriendConversation),
    };
  }

  async getOrCreateConversation(currentUserId, targetUserId) {
    const otherUser = await userDAO.findById(targetUserId, { select: "username avatar fullName" });
    if (!otherUser) throw new AppError("User not found", 404);

    let conversation = await conversationDAO.findBetweenUsers(currentUserId, targetUserId);

    if (!conversation) {
      const created = await conversationDAO.create({ participants: [currentUserId, targetUserId] });
      conversation = await conversationDAO.findWithPopulatedById(created._id);
    }

    return conversation;
  }

  async getMessages(conversationId, userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    const conversation = await conversationDAO.findById(conversationId, userId);
    if (!conversation) throw new AppError("Conversation not found", 404);

    const [messages, total] = await Promise.all([
      messageDAO.findByConversation(conversationId, { skip, limit }),
      messageDAO.count(conversationId),
    ]);

    // Đảo ngược để oldest first
    messages.reverse();

    return {
      messages,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    };
  }

  async sendMessage(conversationId, senderId, data) {
    const { content, messageType = "text", mediaUrl, isEncrypted = false } = data;

    if (messageType === "text" && (!content || !content.trim())) {
      throw new AppError("Message content is required", 400);
    }

    if (messageType === "image" && !mediaUrl) {
      throw new AppError("Image URL is required for image messages", 400);
    }

    const conversation = await conversationDAO.findById(conversationId, senderId);
    if (!conversation) throw new AppError("Conversation not found", 404);

    const message = await messageDAO.create({
      conversationId,
      sender: senderId,
      content: content ? content.trim() : "",
      messageType,
      mediaUrl: mediaUrl || "",
      isEncrypted,
    });

    await message.populate("sender", "username avatar fullName");

    // Cập nhật conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;

    const otherParticipant = conversation.participants.find((p) => p.toString() !== senderId.toString());

    await conversationDAO.incrementUnread(conversation, otherParticipant);

    // Emit encrypted message via Socket.io
    try {
      const io = getIO();
      io.to(`user:${otherParticipant}`).emit("message:new", {
        message: message.toJSON(),
        conversationId,
      });
      logger.info(`${isEncrypted ? "Encrypted" : "Plain"} message sent to user:${otherParticipant}`);
    } catch (socketError) {
      logger.error("Socket emit error:", socketError.message);
    }

    return message;
  }

  async markAsRead(conversationId, userId) {
    const conversation = await conversationDAO.findById(conversationId, userId);
    if (!conversation) throw new AppError("Conversation not found", 404);

    await messageDAO.markAsRead(conversationId, userId);
    await conversationDAO.resetUnread(conversation, userId);

    // Emit read event
    try {
      const io = getIO();
      const otherParticipant = conversation.participants.find((p) => p.toString() !== userId.toString());
      io.to(`user:${otherParticipant}`).emit("messages:read", { conversationId, readBy: userId });
    } catch (socketError) {
      logger.error("Socket emit error:", socketError.message);
    }
  }
}

module.exports = new ChatService();
