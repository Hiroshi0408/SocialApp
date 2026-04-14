const storyService = require("../services/storyService");
const logger = require("../utils/logger");

// [POST] /api/stories
exports.createStory = async (req, res, next) => {
  try {
    logger.info(`Create story - User: ${req.user.username}`);
    const story = await storyService.createStory(req.user.id, req.body);
    res.status(201).json({ success: true, message: "Story created successfully", story });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/stories
exports.getAllStories = async (req, res, next) => {
  try {
    const storyGroups = await storyService.getAllStories(req.user.id);
    res.json({ success: true, storyGroups });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/stories/user/:userId
exports.getUserStories = async (req, res, next) => {
  try {
    const stories = await storyService.getUserStories(req.params.userId, req.user.id);
    res.json({ success: true, stories });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/stories/:storyId/view
exports.viewStory = async (req, res, next) => {
  try {
    const result = await storyService.viewStory(req.params.storyId, req.user.id);
    res.json({ success: true, message: "Story viewed", ...result });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/stories/:storyId
exports.deleteStory = async (req, res, next) => {
  try {
    await storyService.deleteStory(req.params.storyId, req.user.id);
    res.json({ success: true, message: "Story deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/stories/:storyId/viewers
exports.getStoryViewers = async (req, res, next) => {
  try {
    const result = await storyService.getStoryViewers(req.params.storyId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
