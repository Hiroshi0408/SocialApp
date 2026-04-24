const mongoose = require("mongoose");

const donationSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    // Lưu luôn onChainId để debug / verify mà không phải populate Campaign
    onChainCampaignId: { type: Number, required: true },

    // Ví donor — lowercase để so sánh nhất quán
    donor: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Nếu ví đã link User thì tag vào cho UI hiển thị username/avatar
    donorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    amountWei: { type: String, required: true }, // BigInt wei as string
    txHash: { type: String, required: true, lowercase: true, trim: true },
    blockNumber: { type: Number, default: null },
    donatedAt: { type: Date, default: Date.now },

    // Pull payment — donor tự gọi claimRefund khi campaign FAILED
    refunded: { type: Boolean, default: false },
    refundTxHash: { type: String, default: null },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique — chống duplicate khi FE retry gọi /record cùng 1 txHash
donationSchema.index({ txHash: 1 }, { unique: true });
// List donor theo campaign (pagination newest-first)
donationSchema.index({ campaignId: 1, donatedAt: -1 });
// Lịch sử donation của 1 ví
donationSchema.index({ donor: 1, donatedAt: -1 });

const Donation = mongoose.model("Donation", donationSchema, "donations");

module.exports = Donation;
