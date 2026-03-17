const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    groupName: {
      type: String,
      trim: true,
      maxlength: [100, "Group name cannot exceed 100 characters"],
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Validate participants theo type
conversationSchema.pre("save", function (next) {
  if (this.type === "direct" && this.participants.length !== 2) {
    return next(
      new Error("Direct conversation must have exactly 2 participants"),
    );
  }
  if (this.type === "group" && this.participants.length < 3) {
    return next(
      new Error("Group conversation must have at least 3 participants"),
    );
  }
  if (this.type === "group" && !this.groupName) {
    return next(new Error("Group name is required"));
  }
  next();
});

// Tìm conversation 1-1 giữa 2 users
conversationSchema.statics.findBetweenUsers = async function (
  userId1,
  userId2,
) {
  return this.findOne({
    type: "direct",
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
  "conversations",
);

module.exports = Conversation;
