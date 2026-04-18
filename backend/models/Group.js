const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
      maxlength: [100, "Group name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Group description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      default: "",
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    membersCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Nếu group được tạo bởi verified Organization (auto-create khi verify) → không cho bán
    // trong GroupMarketplace. Null = group thường của user.
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

groupSchema.index({ name: 1, createdAt: -1 });
groupSchema.index({ members: 1 });
groupSchema.index({ creator: 1, createdAt: -1 });

const Group = mongoose.model("Group", groupSchema, "groups");

module.exports = Group;
