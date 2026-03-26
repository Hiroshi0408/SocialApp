const mongoose = require("mongoose");

const friendshipSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true });
friendshipSchema.index({ userA: 1, createdAt: -1 });
friendshipSchema.index({ userB: 1, createdAt: -1 });

friendshipSchema.pre("save", function (next) {
  if (this.userA.equals(this.userB)) {
    return next(new Error("Cannot create friendship with yourself"));
  }
  next();
});

const Friendship = mongoose.model(
  "Friendship",
  friendshipSchema,
  "friendships",
);

module.exports = Friendship;
