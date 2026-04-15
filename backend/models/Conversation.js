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
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
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

const Conversation = mongoose.model(
  "Conversation",
  conversationSchema,
  "conversations",
);

module.exports = Conversation;
