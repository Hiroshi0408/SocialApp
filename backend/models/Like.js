const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ["post", "comment"],
      required: true,
      default: "post",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - prevent duplicate likes
likeSchema.index({ userId: 1, targetId: 1, targetType: 1 }, { unique: true });
likeSchema.index({ targetId: 1, createdAt: -1 });
likeSchema.index({ userId: 1, createdAt: -1 });

const Like = mongoose.model("Like", likeSchema, "likes");

module.exports = Like;
