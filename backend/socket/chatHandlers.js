const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

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
      console.log(
        `✓ User ${socket.username} joined conversation ${conversationId}`
      );

      socket.emit("chat:joined", { conversationId });
    } catch (error) {
      console.error("Join conversation error:", error);
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  // Leave a conversation room
  socket.on("chat:leave", (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    console.log(
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

      // Increment unread count for other participant
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== socket.userId
      );

      if (!conversation.unreadCount) {
        conversation.unreadCount = new Map();
      }
      const currentUnread =
        conversation.unreadCount.get(otherParticipant.toString()) || 0;
      conversation.unreadCount.set(
        otherParticipant.toString(),
        currentUnread + 1
      );

      await conversation.save();

      const messageData = message.toJSON();

      // Emit to conversation room (real-time to both users if online)
      io.to(`conversation:${conversationId}`).emit("chat:message", {
        message: messageData,
        conversationId,
      });

      // Also emit to recipient's personal room (for notifications when not in chat)
      io.to(`user:${otherParticipant}`).emit("message:new", {
        message: messageData,
        conversationId,
      });

      console.log(
        `✓ Message sent in conversation ${conversationId} by ${socket.username}`
      );
    } catch (error) {
      console.error("Send message error:", error);
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

      // Mark messages as read
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: socket.userId },
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      // Reset unread count
      if (!conversation.unreadCount) {
        conversation.unreadCount = new Map();
      }
      conversation.unreadCount.set(socket.userId, 0);
      await conversation.save();

      // Notify other participant
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== socket.userId
      );

      io.to(`user:${otherParticipant}`).emit("messages:read", {
        conversationId,
        readBy: socket.userId,
      });

      console.log(
        `✓ Messages marked as read in conversation ${conversationId} by ${socket.username}`
      );
    } catch (error) {
      console.error("Mark as read error:", error);
      socket.emit("error", { message: "Failed to mark as read" });
    }
  });
};

module.exports = setupChatHandlers;
