const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    // Track unread count for each participant
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure participants are unique and efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Ensure exactly 2 participants for 1-1 chat
conversationSchema.pre("save", function (next) {
  if (this.participants.length !== 2) {
    return next(new Error("Conversation must have exactly 2 participants"));
  }
  next();
});

// Method to find conversation between two users
conversationSchema.statics.findBetweenUsers = async function (
  userId1,
  userId2
) {
  return this.findOne({
    participants: { $all: [userId1, userId2] },
  })
    .populate("participants", "username avatar fullName")
    .populate({
      path: "lastMessage",
      select: "content sender createdAt read",
    });
};

conversationSchema.methods.toJSON = function () {
  const conversation = this.toObject();
  delete conversation.__v;
  return conversation;
};

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema,
  "conversations"
);

module.exports = Conversation;
