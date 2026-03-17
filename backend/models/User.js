const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { DEFAULT_AVATAR_URL } = require("../constants");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ],
      index: true, // Thêm index: true ở đây
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
      index: true, // Thêm index: true ở đây
    },
    password: {
      type: String,
      // Password chỉ required nếu KHÔNG phải Google account
      required: function () {
        return !this.isGoogleAccount;
      },
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    avatar: {
      type: String,
      default: DEFAULT_AVATAR_URL,
    },
    bio: {
      type: String,
      default: "",
      maxlength: [150, "Bio cannot exceed 150 characters"],
    },
    website: {
      type: String,
      default: "",
    },

    firebaseUid: {
      type: String,
      sparse: true,
      index: true,
    },
    isGoogleAccount: {
      type: Boolean,
      default: false,
    },

    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    postsCount: {
      type: Number,
      default: 0,
    },

    isPrivate: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    role: {
      type: String,
      enum: ["user", "mod", "admin"],
      default: "user",
      index: true,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  },
);

// Bỏ các index duplicate, chỉ giữ index cho createdAt
userSchema.index({ createdAt: -1 });

// Encrypt password whenever password is modified and non-empty
userSchema.pre("save", async function (next) {
  // Skip only when password is unchanged or empty.
  // This allows Google-linked accounts to set/reset a password safely.
  if (!this.isModified("password") || !this.password) {
    return next();
  }

  // If password is already a bcrypt hash, avoid hashing again.
  if (/^\$2[aby]\$\d{2}\$/.test(this.password)) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password - allow password auth whenever a password exists
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    // Cannot compare if account has no stored password
    if (!this.password) {
      return false;
    }

    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.deleted;
  delete user.deletedAt;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.__v;
  return user;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

const User = mongoose.model("User", userSchema, "users");

module.exports = User;
