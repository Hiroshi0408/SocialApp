const userDAO = require("../dao/userDAO");
const admin = require("../config/firebaseAdmin");
const logger = require("../utils/logger.js");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/emailService");
const { generateToken, generateRawToken } = require("../helpers/generate");

//[POST] /api/auth/register
exports.register = async (req, res) => {
  try {
    const { fullName, username, email, password } = req.body;
    logger.info("Register attempt:", { username, email });
    const existingUser = await userDAO.findOne({
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

    const user = await userDAO.createUser({
      fullName,
      username,
      email,
      password,
    });
    logger.info("User registered successfully:", user.username);

    const verificationToken = generateRawToken();
    await userDAO.saveVerificationToken(user._id, verificationToken);

    try {
      await sendVerificationEmail(user.email, user.username, verificationToken);
      logger.info("Verification email sent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to send verification email:", emailError.message);
    }

    const token = generateToken(user._id, user.username);

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email to verify your account.",
      token,
      user,
    });
  } catch (error) {
    logger.error("Register error:", error);

    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });
      return res
        .status(400)
        .json({ success: false, message: "Validation failed", errors });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({ success: false, message: `${field} already exists` });
    }

    return res.status(500).json({
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

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }

    // findByUsernameOrEmail đã select +password và filter deleted/status
    const user = await userDAO.findByUsernameOrEmail(username);

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    logger.info("Login successful:", user.username);

    const token = generateToken(user._id, user.username);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/google-login
exports.googleLogin = async (req, res) => {
  try {
    const { googleToken, email, displayName, photoURL } = req.body;
    logger.info("Google login attempt:", email);

    // Verify Firebase token
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(googleToken);
    } catch (error) {
      logger.error("Firebase token verification failed:", error);

      const errorMap = {
        "auth/id-token-expired": "Token expired. Please login again",
        "auth/argument-error": "Invalid token format",
      };

      return res.status(401).json({
        success: false,
        message: errorMap[error.code] || "Invalid Google token",
      });
    }

    const tokenEmail = decodedToken.email?.toLowerCase();

    if (!tokenEmail) {
      return res
        .status(401)
        .json({ success: false, message: "Google account has no email" });
    }

    if (!decodedToken.email_verified) {
      return res
        .status(401)
        .json({ success: false, message: "Google email is not verified" });
    }

    if (email && tokenEmail !== email.toLowerCase()) {
      logger.error("Email mismatch - Token:", tokenEmail, "Request:", email);
      return res
        .status(401)
        .json({ success: false, message: "Email verification failed" });
    }

    const tokenDisplayName = decodedToken.name || displayName;
    const tokenPhotoURL = decodedToken.picture || photoURL;

    let user = await userDAO.findByEmail(tokenEmail);

    if (!user) {
      // Tạo username unique từ email
      let baseUsername = tokenEmail
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      let username = baseUsername;
      let counter = 1;
      while (await userDAO.existsByUsername(username)) {
        username = `${baseUsername}${counter++}`;
      }

      user = await userDAO.createUser({
        email: tokenEmail,
        fullName: tokenDisplayName || tokenEmail.split("@")[0],
        username,
        avatar: tokenPhotoURL || null,
        firebaseUid: decodedToken.uid,
        isGoogleAccount: true,
        isEmailVerified: true,
      });

      logger.info("New Google user created:", {
        username: user.username,
        email: user.email,
      });
    } else {
      // Kiểm tra Firebase UID conflict
      if (user.firebaseUid && user.firebaseUid !== decodedToken.uid) {
        logger.error("Firebase UID mismatch for email:", tokenEmail);
        return res
          .status(401)
          .json({ success: false, message: "Google account mismatch" });
      }

      // Build update payload chỉ với các field cần thay đổi
      const updates = {};
      if (!user.firebaseUid) {
        updates.firebaseUid = decodedToken.uid;
        updates.isGoogleAccount = true;
      }
      if (!user.isEmailVerified && decodedToken.email_verified) {
        updates.isEmailVerified = true;
      }
      if (tokenPhotoURL && !user.avatar) {
        updates.avatar = tokenPhotoURL;
      }
      if (tokenDisplayName && !user.fullName) {
        updates.fullName = tokenDisplayName;
      }

      if (Object.keys(updates).length > 0) {
        user = await userDAO.updateById(user._id, updates);
      }

      logger.info("Existing user logged in with Google:", user.username);
    }

    const token = generateToken(user._id, user.username);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Google login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/auth/me
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await userDAO.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    logger.error("Get current user error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/logout
exports.logout = async (req, res) => {
  // JWT là stateless — client tự xóa token ở phía frontend.
  // Nếu cần blacklist token, implement Redis token store ở đây.
  return res.json({ success: true, message: "Logout successful" });
};

// ==================== EMAIL VERIFICATION ====================

//[POST] /api/auth/verify-email/:token
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    // findByVerificationToken tự hash token bên trong DAO
    const user = await userDAO.findByVerificationToken(token);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Clear token và đánh dấu verified trong 1 lần update
    await userDAO.clearVerificationToken(user._id);
    logger.info("Email verified for user:", user.username);

    // Lấy lại user sau khi update để trả về data mới nhất
    const updatedUser = await userDAO.findById(user._id);

    return res.json({
      success: true,
      message: "Email verified successfully",
      user: updatedUser.toJSON(),
    });
  } catch (error) {
    logger.error("Email verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Email verification failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/resend-verification
exports.resendVerification = async (req, res) => {
  try {
    const user = await userDAO.findById(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.isEmailVerified) {
      return res
        .status(400)
        .json({ success: false, message: "Email is already verified" });
    }

    const verificationToken = generateRawToken();
    await userDAO.saveVerificationToken(user._id, verificationToken);

    try {
      await sendVerificationEmail(user.email, user.username, verificationToken);
      logger.info("Verification email resent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to resend verification email:", emailError.message);
      return res
        .status(500)
        .json({ success: false, message: "Failed to send verification email" });
    }

    return res.json({
      success: true,
      message: "Verification email sent. Please check your inbox.",
    });
  } catch (error) {
    logger.error("Resend verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ==================== PASSWORD ====================

//[POST] /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  // Response luôn là 200 để tránh user enumeration
  const genericResponse = {
    success: true,
    message:
      "If an account exists with that email, a password reset link has been sent.",
  };

  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide your email" });
    }

    const user = await userDAO.findByEmail(email);
    if (!user) {
      return res.json(genericResponse);
    }

    const resetToken = generateRawToken();
    await userDAO.savePasswordResetToken(user._id, resetToken);

    try {
      await sendPasswordResetEmail(user.email, user.username, resetToken);
      logger.info("Password reset email sent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to send password reset email:", emailError.message);
      await userDAO.clearPasswordResetToken(user._id);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email",
      });
    }

    return res.json(genericResponse);
  } catch (error) {
    logger.error("Forgot password error:", error);
    return res.status(500).json({
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

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const user = await userDAO.findByResetToken(token);

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

    return res.json({
      success: true,
      message: "Password reset successful",
      token: authToken,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Reset password error:", error);
    return res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
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

    const user = await userDAO.findByIdWithPassword(req.user.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    logger.info("Password changed successfully for user:", user.username);

    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    logger.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
