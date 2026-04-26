const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    categories: { type: [String], default: [] },

    // User sở hữu org, được quyền tạo campaign sau khi verified
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Ví được admin whitelist on-chain khi verify.
    // Bắt buộc và unique — 1 ví chỉ map 1 org để tránh lẫn campaign.
    walletAddress: {
      type: String,
      required: [true, "Wallet address is required"],
      lowercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    verifiedAt: { type: Date, default: null },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedReason: { type: String, default: "" },

    // Bằng chứng (ảnh giấy phép, ...) upload qua Cloudinary
    proofDocuments: { type: [String], default: [] },
    contactEmail: { type: String, default: "", trim: true },
    website: { type: String, default: "", trim: true },

    // Group chat official của org, auto-create khi verify
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },

    // On-chain metadata — lưu sau khi admin whitelist org
    onChain: {
      whitelistTxHash: { type: String, default: null },
      whitelistBlockNumber: { type: Number, default: null },
      whitelistedAt: { type: Date, default: null },
    },

    // Stats cache — update khi charity flow chạy sau này
    campaignsCount: { type: Number, default: 0, min: 0 },
    totalRaised: { type: String, default: "0" }, // wei BigInt as string

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

organizationSchema.index({ walletAddress: 1 }, { unique: true, sparse: true });
organizationSchema.index({ status: 1, createdAt: -1 });
organizationSchema.index({ owner: 1, status: 1 });

const Organization = mongoose.model("Organization", organizationSchema, "organizations");

module.exports = Organization;
