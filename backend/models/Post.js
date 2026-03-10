const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    image: {
      type: String,
      default: "",
    },
    video: {
      type: String,
      default: "",
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    videoDuration: {
      type: Number,
      default: 0,
    },
    caption: {
      type: String,
      default: "",
      maxlength: [2200, "Caption cannot exceed 2200 characters"],
      trim: true,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    hashtags: {
      type: [String],
      default: [],
    },
    mentions: {
      type: [String],
      default: [],
    },
    taggedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    likesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sharesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    savesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    allowComments: {
      type: Boolean,
      default: true,
    },
    hideLikesCount: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ userId: 1, deleted: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likesCount: -1 });
postSchema.index({ deleted: 1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ taggedUsers: 1, createdAt: -1 });

// Extract hashtags from caption
postSchema.methods.extractHashtags = function () {
  const regex = /#[\w]+/g;
  const matches = this.caption.match(regex);
  this.hashtags = matches ? matches.map((tag) => tag.toLowerCase()) : [];
};

// Extract mentions from caption
postSchema.methods.extractMentions = function () {
  const regex = /@([a-zA-Z0-9._]+)/g;
  const mentions = [];
  let match;

  while ((match = regex.exec(this.caption)) !== null) {
    const username = match[1].toLowerCase();
    if (!mentions.includes(username)) {
      mentions.push(username);
    }
  }

  this.mentions = mentions;
};

// Hide sensitive data
postSchema.methods.toJSON = function () {
  const post = this.toObject();
  delete post.deleted;
  delete post.deletedAt;
  delete post.__v;
  return post;
};

// Extract hashtags and mentions before saving
postSchema.pre("save", function (next) {
  if (this.isModified("caption")) {
    this.extractHashtags();
    this.extractMentions();
  }
  next();
});

const Post = mongoose.model("Post", postSchema, "posts");

module.exports = Post;
