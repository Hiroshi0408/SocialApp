const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const logger = require("../utils/logger.js");

const setupChatHandlers = (io, socket) => {
  // Join a conversation room
  socket.on("chat:join", async (conversationId) => {
    try {
      // Verify user is participant of this conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      socket.join(`conversation:${conversationId}`);
      logger.info(
        `✓ User ${socket.username} joined conversation ${conversationId}`
      );

      socket.emit("chat:joined", { conversationId });
    } catch (error) {
      logger.error("Join conversation error:", error);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  // Leave a conversation room
  socket.on("chat:leave", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    logger.info(
      `✓ User ${socket.username} left conversation ${conversationId}`
    );
  });

  // Typing indicator
  socket.on("chat:typing", ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit("chat:typing", {
      userId: socket.userId,
      username: socket.username,
      conversationId,
      isTyping,
    });
  });

  // Send message via Socket.io (real-time)
  socket.on("chat:message", async (data) => {
    try {
      const {
        conversationId,
        content,
        messageType = "text",
        mediaUrl,
        isEncrypted = false,
      } = data;

      if (!content || !content.trim()) {
        socket.emit("error", { message: "Message content is required" });
        return;
      }

      // Verify user is participant of this conversation
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      // Create message
      const message = await Message.create({
        conversationId,
        sender: socket.userId,
        content: content.trim(),
        messageType,
        mediaUrl,
        isEncrypted, // Save encryption status
      });

      // Populate sender info
      await message.populate("sender", "username avatar fullName");

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;

      // Increment unread count cho tất cả participant trừ người gửi
      if (!conversation.unreadCount) {
        conversation.unreadCount = new Map();
      }
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== socket.userId
      );
      for (const participant of otherParticipants) {
        const current = conversation.unreadCount.get(participant.toString()) || 0;
        conversation.unreadCount.set(participant.toString(), current + 1);
      }

      await conversation.save();

      const messageData = message.toJSON();

      // Emit to conversation room (real-time to all members if online)
      io.to(`conversation:${conversationId}`).emit("chat:message", {
        message: messageData,
        conversationId,
      });

      // Emit to each recipient's personal room (notification khi không mở chat)
      for (const participant of otherParticipants) {
        io.to(`user:${participant}`).emit("message:new", {
          message: messageData,
          conversationId,
        });
      }

      logger.info(
        `✓ Message sent in conversation ${conversationId} by ${socket.username}`
      );
    } catch (error) {
      logger.error("Send message error:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  // Mark messages as read
  socket.on("chat:read", async ({ conversationId }) => {
    try {
      // Verify user is participant
      const conversation = await Conversation.findOne({
        _id: conversationId,
        participants: socket.userId,
      });

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      // Thêm userId vào readBy của các message chưa đọc (không phải do mình gửi)
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: socket.userId },
          readBy: { $ne: socket.userId },
        },
        { $addToSet: { readBy: socket.userId } }
      );

      // Reset unread count của user này
      if (!conversation.unreadCount) {
        conversation.unreadCount = new Map();
      }
      conversation.unreadCount.set(socket.userId, 0);
      await conversation.save();

      // Notify các participant còn lại
      const otherParticipants = conversation.participants.filter(
        (p) => p.toString() !== socket.userId
      );
      for (const participant of otherParticipants) {
        io.to(`user:${participant}`).emit("messages:read", {
          conversationId,
          readBy: socket.userId,
        });
      }

      logger.info(
        `✓ Messages marked as read in conversation ${conversationId} by ${socket.username}`
      );
    } catch (error) {
      logger.error("Mark as read error:", error);
      socket.emit("error", { message: "Failed to mark as read" });
    }
  });
};

module.exports = setupChatHandlers;
