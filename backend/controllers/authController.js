const User = require("../models/User");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const admin = require("../config/firebaseAdmin");
const { JWT_EXPIRATION } = require("../constants");
const logger = require("../utils/logger.js");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/emailService");

const generateToken = (userId, username) => {
  return jwt.sign({ id: userId, username: username }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || JWT_EXPIRATION,
  });
};

//[POST] /api/auth/register
exports.register = async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;

    logger.info("Register attempt:", { username, email });

    // Validate required fields
    if (!fullName || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Username or email already exists",
        errors: {
          username:
            existingUser.username === username
              ? "Username already taken"
              : null,
          email:
            existingUser.email === email ? "Email already registered" : null,
        },
      });
    }

    // Create user
    const user = new User({
      fullName,
      username,
      email,
      password,
    });

    await user.save();

    logger.info("User registered successfully:", user.username);

    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail(user.email, user.username, verificationToken);
      logger.info("Verification email sent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to send verification email:", emailError.message);
    }

    const token = generateToken(user._id, user.username);

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Register error:", error);

    // Mongoose validation errors
    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/login
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.info("Login attempt:", username);

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    // Find user (include password for comparison)
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
      deleted: false,
      status: "active",
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    logger.info("Login successful:", user.username);

    const token = generateToken(user._id, user.username);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/google-login - METHOD MỚI
exports.googleLogin = async (req, res) => {
  try {
    const { googleToken, email, displayName, photoURL } = req.body;

    logger.info("Google login attempt:", email);

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(googleToken);
    } catch (error) {
      logger.error("Firebase token verification failed:", error);

      if (error.code === "auth/id-token-expired") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please login again",
        });
      }

      if (error.code === "auth/argument-error") {
        return res.status(401).json({
          success: false,
          message: "Invalid token format",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid Google token",
      });
    }
    if (decodedToken.email !== email) {
      logger.error(
        "Email mismatch - Token:",
        decodedToken.email,
        "Request:",
        email,
      );
      return res.status(401).json({
        success: false,
        message: "Email verification failed",
      });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      let baseUsername = email
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      let username = baseUsername;
      let counter = 1;

      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = new User({
        email: email.toLowerCase(),
        fullName: displayName || email.split("@")[0],
        username,
        avatar: photoURL || null,
        firebaseUid: decodedToken.uid,
        isGoogleAccount: true,
        isEmailVerified: true,
      });

      await user.save({ validateBeforeSave: false });

      logger.info("New Google user created:", {
        username: user.username,
        email: user.email,
      });
    } else {
      let updated = false;

      if (!user.firebaseUid && !user.password) {
        user.firebaseUid = decodedToken.uid;
        user.isGoogleAccount = true;
        updated = true;
      } else if (!user.firebaseUid && user.password) {
        user.firebaseUid = decodedToken.uid;
        updated = true;
      }
      if (!user.isEmailVerified && decodedToken.email_verified) {
        user.isEmailVerified = true;
        updated = true;
      }
      if (photoURL && !user.avatar) {
        user.avatar = photoURL;
        updated = true;
      }
      if (updated) {
        await user.save({ validateBeforeSave: false });
      }

      logger.info("Existing user logged in with Google:", user.username);
    }
    const token = generateToken(user._id, user.username);
    res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Google login error:", error);

    res.status(500).json({
      success: false,
      message: "Google login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/auth/me
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/logout
exports.logout = async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

//[POST] /api/auth/verify-email/:token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    }).select("+emailVerificationToken +emailVerificationExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.info("Email verified for user:", user.username);

    res.json({
      success: true,
      message: "Email verified successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendVerificationEmail(user.email, user.username, verificationToken);
      logger.info("Verification email resent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to resend verification email:", emailError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to send verification email",
      });
    }

    res.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    logger.error("Resend verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide your email",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.json({
        success: true,
        message:
          "If an account exists with that email, a password reset link has been sent.",
      });
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail(user.email, user.username, resetToken);
      logger.info("Password reset email sent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to send password reset email:", emailError.message);
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email",
      });
    }

    res.json({
      success: true,
      message:
        "If an account exists with that email, a password reset link has been sent.",
    });
  } catch (error) {
    logger.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset request failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/reset-password/:token
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    logger.info("Reset password attempt with token:", token);
    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select("+password +passwordResetToken +passwordResetExpires");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset token",
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info("Password reset successful for user:", user.username);

    const authToken = generateToken(user._id, user.username);

    res.json({
      success: true,
      message: "Password reset successful",
      token: authToken,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(userId).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    await user.save();

    logger.info("Password changed successfully for user:", user.username);

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
