const rateLimit = require("express-rate-limit");
const {
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS,
  LOGIN_RATE_LIMIT_MAX,
  REGISTER_RATE_LIMIT_MAX,
} = require("../constants");

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: RATE_LIMIT_MAX_REQUESTS, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: LOGIN_RATE_LIMIT_MAX, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: "Too many login attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiter for registration
const registerLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: REGISTER_RATE_LIMIT_MAX, // Limit each IP to 3 registrations per windowMs
  message: {
    success: false,
    message:
      "Too many registration attempts, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for creating posts
const createPostLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 posts per minute
  message: {
    success: false,
    message: "You're posting too quickly. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for comments
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 comments per minute
  message: {
    success: false,
    message: "You're commenting too quickly. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for follow/unfollow actions
const followLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Max 20 follow actions per minute
  message: {
    success: false,
    message: "Too many follow/unfollow actions. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for like actions
const likeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 likes per minute
  message: {
    success: false,
    message: "You're liking too quickly. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for upload actions
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 uploads per minute
  message: {
    success: false,
    message: "Too many upload attempts. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for search actions
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 searches per minute
  message: {
    success: false,
    message: "Too many search requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  registerLimiter,
  createPostLimiter,
  commentLimiter,
  followLimiter,
  likeLimiter,
  uploadLimiter,
  searchLimiter,
};
