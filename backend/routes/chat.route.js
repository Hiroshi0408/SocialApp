const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  userIdValidation,
  conversationIdValidation,
} = require("../middlewares/validation.middleware");

// All chat routes require authentication
router.use(authMiddleware);

// Get all conversations for current user
router.get("/conversations", chatController.getConversations);

// Get or create conversation with specific user
router.get(
  "/conversations/:userId",
  userIdValidation,
  chatController.getOrCreateConversation
);

// Get messages in a conversation
router.get(
  "/conversations/:conversationId/messages",
  conversationIdValidation,
  chatController.getMessages
);

// Send a message
router.post(
  "/conversations/:conversationId/messages",
  conversationIdValidation,
  chatController.sendMessage
);

// Mark messages as read
router.put(
  "/conversations/:conversationId/read",
  conversationIdValidation,
  chatController.markAsRead
);

module.exports = router;
