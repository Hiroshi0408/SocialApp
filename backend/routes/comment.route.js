const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authMiddleware = require("../middlewares/auth.middleware");
const { likeLimiter } = require("../middlewares/rateLimiter.middleware");
const { mongoIdValidation } = require("../middlewares/validation.middleware");

// All comment routes require authentication
router.use(authMiddleware);

// Comment operations
router.get(
  "/:id/replies",
  mongoIdValidation,
  commentController.getCommentReplies,
);
router.delete("/:id", mongoIdValidation, commentController.deleteComment);
router.post(
  "/:id/like",
  likeLimiter,
  mongoIdValidation,
  commentController.toggleCommentLike,
);

module.exports = router;
