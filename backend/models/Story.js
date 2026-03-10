const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    image: {
      type: String,
      required: [true, "Story image is required"],
    },
    caption: {
      type: String,
      default: "",
      maxlength: [500, "Caption cannot exceed 500 characters"],
      trim: true,
    },
    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    viewers: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

storySchema.methods.toJSON = function () {
  const story = this.toObject();
  delete story.__v;
  return story;
};

// Set expiration to 24 hours from now
storySchema.pre("save", function (next) {
  if (this.isNew && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }
  next();
});

const Story = mongoose.model("Story", storySchema, "stories");

module.exports = Story;
