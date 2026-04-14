const chatService = require("../services/chatService");
const logger = require("../utils/logger");

// [GET] /api/chat/conversations
exports.getConversations = async (req, res, next) => {
  try {
    const result = await chatService.getConversations(req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/chat/conversations/:userId
exports.getOrCreateConversation = async (req, res, next) => {
  try {
    const conversation = await chatService.getOrCreateConversation(req.user.id, req.params.userId);
    res.json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/chat/conversations/:conversationId/messages
exports.getMessages = async (req, res, next) => {
  try {
    const result = await chatService.getMessages(req.params.conversationId, req.user.id, req.query);
    logger.info(`Retrieved ${result.messages.length} messages`);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/chat/conversations/:conversationId/messages
exports.sendMessage = async (req, res, next) => {
  try {
    const message = await chatService.sendMessage(req.params.conversationId, req.user.id, req.body);
    res.status(201).json({ success: true, message: message.toJSON() });
  } catch (error) {
    next(error);
  }
};

// [PUT] /api/chat/conversations/:conversationId/read
exports.markAsRead = async (req, res, next) => {
  try {
    await chatService.markAsRead(req.params.conversationId, req.user.id);
    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    next(error);
  }
};
