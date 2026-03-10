const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    follower: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index - prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Index for quick lookups
followSchema.index({ follower: 1, createdAt: -1 });
followSchema.index({ following: 1, createdAt: -1 });

// Prevent self-follow
followSchema.pre("save", function (next) {
  if (this.follower.equals(this.following)) {
    return next(new Error("Cannot follow yourself"));
  }
  next();
});

const Follow = mongoose.model("Follow", followSchema, "follows");

module.exports = Follow;
