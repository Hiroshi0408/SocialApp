const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { getIO } = require("../config/socket");

// [GET] /api/chat/conversations - Get all conversations for current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "_id username avatar fullName")
      .populate({
        path: "lastMessage",
        select: "content sender createdAt read messageType isEncrypted",
      })
      .sort({ lastMessageAt: -1 })
      .lean();

    const formattedConversations = conversations.map((conv) => {
      const otherParticipant = conv.participants.find(
        (p) => p._id.toString() !== userId.toString(),
      );

      const unreadCount = conv.unreadCount?.[userId] || 0;

      return {
        _id: conv._id,
        participant: otherParticipant,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        unreadCount,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({
      success: true,
      conversations: formattedConversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get conversations",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/chat/conversations/:userId - Get or create conversation with user
exports.getOrCreateConversation = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    // Validate other user exists
    const otherUser = await User.findById(userId).select(
      "username avatar fullName",
    );

    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findBetweenUsers(
      currentUserId,
      userId,
    );

    // Create new conversation if doesn't exist
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, userId],
      });

      conversation = await Conversation.findById(conversation._id)
        .populate("participants", "username avatar fullName")
        .lean();
    }

    res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Get/create conversation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get conversation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/chat/conversations/:conversationId/messages - Get messages (encrypted)
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const skip = (page - 1) * limit;

    // Verify user is participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Get messages - TRẢ VỀ VẪN CÒN MÃ HÓA
    // Client sẽ tự decrypt
    const messages = await Message.find({
      conversationId,
      deleted: false,
    })
      .populate("sender", "username avatar fullName")
      .sort({ createdAt: -1 }) // Newest first for pagination
      .skip(skip)
      .limit(limit)
      .lean();

    // Reverse to show oldest first in the UI
    messages.reverse();

    const total = await Message.countDocuments({
      conversationId,
      deleted: false,
    });

    console.log(
      `📨 Retrieved ${messages.length} messages (${messages.filter((m) => m.isEncrypted).length} encrypted)`,
    );

    res.json({
      success: true,
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get messages",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [POST] /api/chat/conversations/:conversationId/messages - Send encrypted message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const {
      content,
      messageType = "text",
      mediaUrl,
      isEncrypted = false,
    } = req.body;
    const senderId = req.user.id;

    // Validation
    if (messageType === "text" && (!content || !content.trim())) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    if (messageType === "image" && !mediaUrl) {
      return res.status(400).json({
        success: false,
        message: "Image URL is required for image messages",
      });
    }

    // Verify user is participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: senderId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const message = await Message.create({
      conversationId,
      sender: senderId,
      content: content ? content.trim() : "",
      messageType,
      mediaUrl: mediaUrl || "",
      isEncrypted, // Lưu flag encryption
    });

    // Populate sender info
    await message.populate("sender", "username avatar fullName");

    // Update conversation
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;

    // Increment unread count for other participant
    const otherParticipant = conversation.participants.find(
      (p) => p.toString() !== senderId,
    );

    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    const currentUnread =
      conversation.unreadCount.get(otherParticipant.toString()) || 0;
    conversation.unreadCount.set(
      otherParticipant.toString(),
      currentUnread + 1,
    );

    await conversation.save();

    // Emit encrypted message via Socket.io to recipient
    try {
      const io = getIO();
      io.to(`user:${otherParticipant}`).emit("message:new", {
        message: message.toJSON(), // Message vẫn còn encrypted
        conversationId,
      });

      console.log(
        `📬 ${isEncrypted ? "Encrypted" : "Plain"} message sent to user:${otherParticipant}`,
      );
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
      // Don't fail the request if socket emit fails
    }

    res.status(201).json({
      success: true,
      message: message.toJSON(),
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PUT] /api/chat/conversations/:conversationId/read - Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify user is participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: userId,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    // Mark all unread messages in this conversation as read
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId }, // Messages not sent by current user
        read: false,
      },
      {
        $set: {
          read: true,
          readAt: new Date(),
        },
      },
    );

    // Reset unread count for current user
    if (!conversation.unreadCount) {
      conversation.unreadCount = new Map();
    }
    conversation.unreadCount.set(userId, 0);
    await conversation.save();

    // Emit read event via Socket.io
    try {
      const io = getIO();
      const otherParticipant = conversation.participants.find(
        (p) => p.toString() !== userId,
      );
      io.to(`user:${otherParticipant}`).emit("messages:read", {
        conversationId,
        readBy: userId,
      });
    } catch (socketError) {
      console.error("Socket emit error:", socketError);
    }

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark messages as read",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
