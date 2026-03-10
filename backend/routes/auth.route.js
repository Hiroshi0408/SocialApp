const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  authLimiter,
  registerLimiter,
} = require("../middlewares/rateLimiter.middleware");
const {
  registerValidation,
  loginValidation,
  googleLoginValidation,
} = require("../middlewares/validation.middleware");

// Public routes
router.post(
  "/register",
  registerLimiter,
  registerValidation,
  authController.register,
);
router.post("/login", authLimiter, loginValidation, authController.login);
router.post(
  "/google-login",
  authLimiter,
  googleLoginValidation,
  authController.googleLogin,
);
router.post("/verify-email/:token", authController.verifyEmail);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// Protected routes
router.get("/me", authMiddleware, authController.getCurrentUser);
router.post("/logout", authMiddleware, authController.logout);
router.post(
  "/resend-verification",
  authMiddleware,
  authController.resendVerification,
);
router.post("/change-password", authMiddleware, authController.changePassword);

module.exports = router;
