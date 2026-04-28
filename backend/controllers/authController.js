const authService = require("../services/authService");
const logger = require("../utils/logger");

//[POST] /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { fullName, username, email, password } = req.body;
    logger.info("Register attempt:", { username, email });

    const result = await authService.register({
      fullName,
      username,
      email,
      password,
    });

    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    logger.info("Login attempt:", username);

    const result = await authService.login(username, password);

    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/google-login
exports.googleLogin = async (req, res, next) => {
  try {
    const { googleToken, email, displayName, photoURL } = req.body;
    logger.info("Google login attempt:", email);

    const result = await authService.googleLogin({
      googleToken,
      email,
      displayName,
      photoURL,
    });

    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/auth/me
exports.getCurrentUser = async (req, res, next) => {
  try {
    const result = await authService.getCurrentUser(req.user.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/logout
exports.logout = (req, res) => {
  // JWT là stateless — client tự xóa token.
  // Nếu cần blacklist token, implement Redis token store ở authService.
  return res.json({ success: true, message: "Logout successful" });
};

// ==================== EMAIL VERIFICATION ====================

//[POST] /api/auth/verify-email/:token
exports.verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.params.token);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/resend-verification
exports.resendVerification = async (req, res, next) => {
  try {
    const result = await authService.resendVerification(req.user.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// ==================== PASSWORD ====================

//[POST] /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/reset-password/:token
exports.resetPassword = async (req, res, next) => {
  try {
    const result = await authService.resetPassword(
      req.params.token,
      req.body.password,
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
