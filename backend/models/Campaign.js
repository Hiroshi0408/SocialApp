const mongoose = require("mongoose");

// Embedded milestone — idx = array index, không cần field riêng
const milestoneSchema = new mongoose.Schema(
  {
    amountWei: { type: String, required: true }, // BigInt wei as string
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    unlocked: { type: Boolean, default: false },
    unlockedTxHash: { type: String, default: null },
    unlockedAt: { type: Date, default: null },
    // Post báo cáo milestone — org đăng post, admin chọn khi unlock
    reportPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    // Null khi chưa confirm tx on-chain. Update sau khi receipt có.
    // Unique sparse → cho phép nhiều doc pending với onChainId = null.
    onChainId: { type: Number, default: null },
    onChainStatus: {
      type: String,
      enum: ["pending", "confirmed", "failed"],
      default: "pending",
      index: true,
    },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    coverImage: { type: String, default: "" },
    category: {
      type: String,
      enum: ["education", "medical", "disaster", "animal", "other"],
      default: "other",
    },

    // Ví nhận tiền — snapshot từ Organization.walletAddress, lowercase
    beneficiary: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Snapshot on-chain cache — LUÔN sync từ contract state, KHÔNG tự += trong code
    // (tránh sai số BigInt + race condition khi 2 donation cùng block)
    goalWei: { type: String, required: true },
    raisedWei: { type: String, default: "0" },
    unlockedTotalWei: { type: String, default: "0" },
    deadline: { type: Date, required: true },

    status: {
      type: String,
      enum: ["OPEN", "FUNDED", "EXECUTING", "COMPLETED", "FAILED", "REFUNDED"],
      default: "OPEN",
      index: true,
    },

    milestones: { type: [milestoneSchema], default: [] },

    // Hash off-chain metadata commit lên contract — recompute để verify không bị sửa lén
    metadataHash: { type: String, required: true, lowercase: true, trim: true },

    createTxHash: { type: String, default: null },
    createBlockNumber: { type: Number, default: null },

    // Stats cache — tăng qua DAO.incrementDonorsCount sau khi check distinct donor
    donorsCount: { type: Number, default: 0, min: 0 },

    deleted: { type: Boolean, default: false },
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

// Lookup nhanh theo onChainId, cho phép nhiều null (sparse)
campaignSchema.index({ onChainId: 1 }, { unique: true, sparse: true });
// Cron markFailedIfExpired — quét OPEN mà deadline đã qua
campaignSchema.index({ status: 1, deadline: 1 });
// /charity/mine
campaignSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
// /charity list + sort theo thời gian
campaignSchema.index({ status: 1, createdAt: -1 });

const Campaign = mongoose.model("Campaign", campaignSchema, "campaigns");

module.exports = Campaign;
