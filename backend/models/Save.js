const mongoose = require("mongoose");

const saveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

saveSchema.index({ userId: 1, postId: 1 }, { unique: true });
saveSchema.index({ userId: 1, createdAt: -1 });

const Save = mongoose.model("Save", saveSchema, "saves");

module.exports = Save;
