// backend/socketHandlers/callHandlers.js
const Conversation = require("../models/Conversation");
const logger = require("../utils/logger.js");

const setupCallHandlers = (io, socket) => {
  logger.info(`📞 Call handlers initialized for user ${socket.username}`);

  // Initiate a call to another user
  socket.on(
    "call:initiate",
    async ({ recipientId, conversationId, isVideoCall = false }) => {
      try {
        // Verify conversation exists and user is participant
        const conversation = await Conversation.findOne({
          _id: conversationId,
          participants: { $all: [socket.userId, recipientId] },
        });

        if (!conversation) {
          socket.emit("call:error", { message: "Conversation not found" });
          return;
        }

        logger.info(
          `📞 ${socket.username} initiating ${isVideoCall ? "video" : "voice"} call to user ${recipientId}`,
        );

        logger.info(
          `📢 Emitting call:incoming to user ${recipientId} in room user:${recipientId}`,
        );
        // Notify recipient about incoming call
        io.to(`user:${recipientId}`).emit("call:incoming", {
          callerId: socket.userId,
          callerUsername: socket.username,
          conversationId,
          isVideoCall,
        });

        // Notify caller that call is ringing
        socket.emit("call:ringing", { recipientId });
      } catch (error) {
        logger.error("Call initiate error:", error);
        socket.emit("call:error", { message: "Failed to initiate call" });
      }
    },
  );

  // Accept incoming call
  socket.on("call:accept", ({ callerId, conversationId }) => {
    logger.info(`✅ ${socket.username} accepted call from ${callerId}`);

    // Notify caller that call was accepted
    io.to(`user:${callerId}`).emit("call:accepted", {
      recipientId: socket.userId,
      conversationId,
    });
  });

  // Reject incoming call
  socket.on("call:reject", ({ callerId, conversationId }) => {
    logger.info(`❌ ${socket.username} rejected call from ${callerId}`);

    // Notify caller that call was rejected
    io.to(`user:${callerId}`).emit("call:rejected", {
      recipientId: socket.userId,
      conversationId,
    });
  });

  // WebRTC Signaling - Send offer
  socket.on("call:offer", ({ recipientId, offer }) => {
    logger.info(
      `📤 Sending offer from ${socket.username} to user ${recipientId}`,
    );

    io.to(`user:${recipientId}`).emit("call:offer", {
      callerId: socket.userId,
      offer,
    });
  });

  // WebRTC Signaling - Send answer
  socket.on("call:answer", ({ callerId, answer }) => {
    logger.info(
      `📤 Sending answer from ${socket.username} to user ${callerId}`,
    );

    io.to(`user:${callerId}`).emit("call:answer", {
      recipientId: socket.userId,
      answer,
    });
  });

  // WebRTC Signaling - ICE Candidate
  socket.on("call:ice-candidate", ({ recipientId, candidate }) => {
    io.to(`user:${recipientId}`).emit("call:ice-candidate", {
      senderId: socket.userId,
      candidate,
    });
  });

  // End call
  socket.on("call:end", ({ recipientId, conversationId }) => {
    logger.info(`📞 ${socket.username} ended call with user ${recipientId}`);

    // Notify other user that call ended
    io.to(`user:${recipientId}`).emit("call:ended", {
      userId: socket.userId,
      conversationId,
    });
  });

  // Toggle mute
  socket.on("call:toggle-mute", ({ recipientId, isMuted }) => {
    io.to(`user:${recipientId}`).emit("call:peer-muted", {
      userId: socket.userId,
      isMuted,
    });
  });

  // Handle disconnect during call
  socket.on("disconnect", () => {
    // You can store active calls in Redis/memory to notify other participant
    logger.info(
      `📞 User ${socket.username} disconnected, ending any active calls`,
    );
  });
};

module.exports = setupCallHandlers;
