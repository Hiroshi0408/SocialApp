const saveService = require("../services/saveService");
const logger = require("../utils/logger");

// [POST] /api/saves/:postId
exports.savePost = async (req, res, next) => {
  try {
    logger.info(`Save post - User: ${req.user.username}, Post: ${req.params.postId}`);
    const result = await saveService.savePost(req.user.id, req.params.postId);
    res.json({ success: true, message: "Post saved successfully", ...result });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/saves/:postId
exports.unsavePost = async (req, res, next) => {
  try {
    logger.info(`Unsave post - User: ${req.user.username}, Post: ${req.params.postId}`);
    const result = await saveService.unsavePost(req.user.id, req.params.postId);
    res.json({ success: true, message: "Post unsaved successfully", ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/saves
exports.getSavedPosts = async (req, res, next) => {
  try {
    logger.info(`Get saved posts - User: ${req.user.username}`);
    const result = await saveService.getSavedPosts(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/saves/:postId/status
exports.checkSaveStatus = async (req, res, next) => {
  try {
    const result = await saveService.checkSaveStatus(req.user.id, req.params.postId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
