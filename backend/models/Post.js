const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    // null = post "bình thường" hiển thị ở feed home/profile.
    // != null = post thuộc group, chỉ hiện ở feed group + member mới xem được.
    // Tách bằng field này thay vì collection riêng để tái dùng toàn bộ like/comment/save flow.
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    // Legacy fields — giữ cho post cũ + làm fallback cho code chưa migrate
    // sang đọc media[]. Khi tạo post mới, BE sẽ mirror media[0] vào image/video
    // theo đúng type để PostCard/Profile cũ vẫn hiển thị được mà không sửa.
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
    // media[] = nguồn dữ liệu chuẩn cho post mới (carousel nhiều ảnh).
    // Quy ước: nếu có video thì chỉ 1 phần tử duy nhất kiểu video (Instagram-style).
    // Nếu là ảnh, max MAX_MEDIA_PER_POST.
    // Post cũ (chưa migrate) → media = [] → service synth từ image/video khi format response.
    media: {
      type: [
        {
          _id: false,
          type: { type: String, enum: ["image", "video"], required: true },
          url: { type: String, required: true },
          duration: { type: Number, default: 0 },
        },
      ],
      default: [],
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
    onChain: {
      registered: { type: Boolean, default: false },
      // null = post cũ (hash v1, không có authorId) — không migrate
      // 'v2' = post mới (hash có authorId để chống copy-claim ownership)
      version: { type: String, default: null },
      contentHash: { type: String, default: null },
      txHash: { type: String, default: null },
      blockNumber: { type: Number, default: null },
      registryPostId: { type: String, default: null },
      revision: { type: Number, default: 0 },
      revisions: {
        type: [
          {
            _id: false,
            revision: { type: Number, required: true },
            registryPostId: { type: String, required: true },
            version: { type: String, default: "v2" },
            contentHash: { type: String, required: true },
            txHash: { type: String, required: true },
            blockNumber: { type: Number, default: null },
            registeredAt: { type: Date, default: Date.now },
            snapshot: {
              caption: { type: String, default: "" },
              location: { type: String, default: "" },
              image: { type: String, default: "" },
              video: { type: String, default: "" },
              mediaType: { type: String, default: "image" },
              videoDuration: { type: Number, default: 0 },
              createdAt: { type: Date, default: null },
              media: {
                type: [
                  {
                    _id: false,
                    type: { type: String, enum: ["image", "video"], required: true },
                    url: { type: String, required: true },
                    duration: { type: Number, default: 0 },
                  },
                ],
                default: [],
              },
            },
          },
        ],
        default: [],
      },
    },
    // Set khi BE auto-tạo post liên quan đến 1 Charity Campaign event.
    // Null = post bình thường do user tự đăng.
    //   kind = "kickoff"   → khi org tạo campaign, milestoneIdx = null
    //   kind = "funded"    → khi đạt goal (OPEN→FUNDED), milestoneIdx = null
    //   kind = "milestone" → khi unlock 1 milestone, milestoneIdx = 0..N
    //   kind = "completed" → khi unlock milestone cuối (COMPLETED), milestoneIdx = null
    // Unique (campaignId, kind, milestoneIdx) đảm bảo idempotent: lỡ retry
    // không tạo trùng post.
    campaignMilestoneRef: {
      campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Campaign",
        default: null,
      },
      milestoneIdx: { type: Number, default: null },
      kind: {
        type: String,
        enum: ["kickoff", "funded", "milestone", "completed"],
        default: null,
      },
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.deleted;
        delete ret.deletedAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ userId: 1, deleted: 1, createdAt: -1 });
postSchema.index({ groupId: 1, deleted: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ likesCount: -1 });
postSchema.index({ deleted: 1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ taggedUsers: 1, createdAt: -1 });
// Unique partial: chỉ áp dụng khi campaignMilestoneRef.campaignId tồn tại — đảm bảo
// 1 (campaign, kind, milestoneIdx) chỉ có 1 auto-post (idempotent khi retry).
// Post user thường (campaignId = null) không bị ảnh hưởng.
// Kind="kickoff"/"funded"/"completed" có milestoneIdx=null → tự constraint 1 post/campaign.
// Kind="milestone" có milestoneIdx=0..N → tự constraint 1 post/milestone.
postSchema.index(
  {
    "campaignMilestoneRef.campaignId": 1,
    "campaignMilestoneRef.kind": 1,
    "campaignMilestoneRef.milestoneIdx": 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      "campaignMilestoneRef.campaignId": { $type: "objectId" },
    },
  }
);

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
