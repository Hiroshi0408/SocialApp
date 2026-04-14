const userDAO = require("../dao/userDAO");
const admin = require("../config/firebaseAdmin");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/emailService");
const { generateToken, generateRawToken } = require("../helpers/generate");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

class AuthService {
  // ==================== REGISTER ====================

  async register({ fullName, username, email, password }) {
    const existing = await userDAO.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    });

    if (existing) {
      throw new AppError("Username or email already exists", 400, {
        username:
          existing.username === username.toLowerCase()
            ? "Username already taken"
            : null,
        email:
          existing.email === email.toLowerCase()
            ? "Email already registered"
            : null,
      });
    }

    const user = await userDAO.createUser({ fullName, username, email, password });
    logger.info("User registered:", user.username);

    const verificationToken = generateRawToken();
    await userDAO.saveVerificationToken(user._id, verificationToken);

    // Email fail không block việc đăng ký
    try {
      await sendVerificationEmail(user.email, user.username, verificationToken);
      logger.info("Verification email sent to:", user.email);
    } catch (emailError) {
      logger.error("Failed to send verification email:", emailError.message);
    }

    const token = generateToken(user._id, user.username);

    return {
      message:
        "Registration successful. Please check your email to verify your account.",
      token,
      user,
    };
  }

  // ==================== LOGIN ====================

  async login(identifier, password) {
    if (!identifier || !password) {
      throw new AppError("Please provide username and password", 400);
    }

    // findByUsernameOrEmail đã tự lọc deleted/status và select +password
    const user = await userDAO.findByUsernameOrEmail(identifier);
    if (!user) {
      throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError("Invalid credentials", 401);
    }

    logger.info("Login successful:", user.username);

    const token = generateToken(user._id, user.username);

    return { message: "Login successful", token, user: user.toJSON() };
  }

  // ==================== GOOGLE LOGIN ====================

  async googleLogin({ googleToken, email, displayName, photoURL }) {
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(googleToken);
    } catch (error) {
      const errorMap = {
        "auth/id-token-expired": "Token expired. Please login again",
        "auth/argument-error": "Invalid token format",
      };
      throw new AppError(errorMap[error.code] || "Invalid Google token", 401);
    }

    const tokenEmail = decodedToken.email?.toLowerCase();

    if (!tokenEmail) {
      throw new AppError("Google account has no email", 401);
    }
    if (!decodedToken.email_verified) {
      throw new AppError("Google email is not verified", 401);
    }
    if (email && tokenEmail !== email.toLowerCase()) {
      logger.error("Email mismatch - Token:", tokenEmail, "Request:", email);
      throw new AppError("Email verification failed", 401);
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

      try {
        user = await userDAO.createUser({
          email: tokenEmail,
          fullName: tokenDisplayName || tokenEmail.split("@")[0],
          username,
          avatar: tokenPhotoURL || null,
          firebaseUid: decodedToken.uid,
          isGoogleAccount: true,
          isEmailVerified: true,
        });
      } catch (err) {
        // Race condition: username bị lấy trước trong khoảnh khắc giữa check và create
        if (err.code === 11000) {
          throw new AppError(
            "Registration conflict, please try again",
            409
          );
        }
        throw err;
      }

      logger.info("New Google user created:", {
        username: user.username,
        email: user.email,
      });
    } else {
      if (user.firebaseUid && user.firebaseUid !== decodedToken.uid) {
        logger.error("Firebase UID mismatch for email:", tokenEmail);
        throw new AppError("Google account mismatch", 401);
      }

      const updates = {};
      if (!user.firebaseUid) {
        updates.firebaseUid = decodedToken.uid;
        updates.isGoogleAccount = true;
      }
      if (!user.isEmailVerified && decodedToken.email_verified) {
        updates.isEmailVerified = true;
      }
      if (tokenPhotoURL && !user.avatar) updates.avatar = tokenPhotoURL;
      if (tokenDisplayName && !user.fullName) updates.fullName = tokenDisplayName;

      if (Object.keys(updates).length > 0) {
        user = await userDAO.updateById(user._id, updates);
      }

      logger.info("Existing user logged in with Google:", user.username);
    }

    const token = generateToken(user._id, user.username);

    return { message: "Login successful", token, user: user.toJSON() };
  }

  // ==================== CURRENT USER ====================

  async getCurrentUser(userId) {
    const user = await userDAO.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    return { user: user.toJSON() };
  }

  // ==================== EMAIL VERIFICATION ====================

  async verifyEmail(rawToken) {
    const user = await userDAO.findByVerificationToken(rawToken);
    if (!user) {
      throw new AppError("Invalid or expired verification token", 400);
    }

    await userDAO.clearVerificationToken(user._id);
    logger.info("Email verified for user:", user.username);

    const updatedUser = await userDAO.findById(user._id);

    return {
      message: "Email verified successfully",
      user: updatedUser.toJSON(),
    };
  }

  async resendVerification(userId) {
    const user = await userDAO.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    if (user.isEmailVerified) {
      throw new AppError("Email is already verified", 400);
    }

    const verificationToken = generateRawToken();
    await userDAO.saveVerificationToken(user._id, verificationToken);

    // Email fail ở đây phải throw vì đây là mục đích chính của request
    await sendVerificationEmail(user.email, user.username, verificationToken);
    logger.info("Verification email resent to:", user.email);

    return { message: "Verification email sent. Please check your inbox." };
  }

  // ==================== PASSWORD ====================

  async forgotPassword(email) {
    const user = await userDAO.findByEmail(email);

    if (user) {
      const resetToken = generateRawToken();
      await userDAO.savePasswordResetToken(user._id, resetToken);

      try {
        await sendPasswordResetEmail(user.email, user.username, resetToken);
        logger.info("Password reset email sent to:", user.email);
      } catch (emailError) {
        logger.error("Failed to send password reset email:", emailError.message);
        await userDAO.clearPasswordResetToken(user._id);
        throw new AppError("Failed to send password reset email", 500);
      }
    }

    // Luôn trả về response giống nhau để tránh user enumeration attack
    return {
      message:
        "If an account exists with that email, a password reset link has been sent.",
    };
  }

  async resetPassword(rawToken, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new AppError("Password must be at least 6 characters", 400);
    }

    const user = await userDAO.findByResetToken(rawToken);
    if (!user) {
      throw new AppError("Invalid or expired password reset token", 400);
    }

    // Dùng document.save() thay vì updateById để trigger pre-save hook bcrypt
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.info("Password reset successful for user:", user.username);

    const token = generateToken(user._id, user.username);

    return {
      message: "Password reset successful",
      token,
      user: user.toJSON(),
    };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new AppError("Please provide current and new password", 400);
    }
    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters", 400);
    }

    const user = await userDAO.findByIdWithPassword(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError("Current password is incorrect", 401);
    }

    user.password = newPassword;
    await user.save();

    logger.info("Password changed successfully for user:", user.username);

    return { message: "Password changed successfully" };
  }
}

module.exports = new AuthService();
