const storyDAO = require("../dao/storyDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");

class StoryService {
  async createStory(userId, data) {
    const { image, caption } = data;

    if (!image) throw new AppError("Story image is required", 400);

    const story = await storyDAO.create({ userId, image, caption: caption || "" });
    await story.populate("userId", "username fullName avatar");

    logger.info(`Story created - User: ${userId}`);

    return {
      ...story.toJSON(),
      user: story.userId,
      hasViewed: false,
      timestamp: "Just now",
    };
  }

  async getAllStories(currentUserId) {
    const stories = await storyDAO.findActive();

    // Group by user
    const storiesByUser = {};
    stories.forEach((story) => {
      const storyUserId = story.userId._id.toString();
      if (!storiesByUser[storyUserId]) {
        storiesByUser[storyUserId] = { user: story.userId, stories: [], hasUnviewed: false };
      }

      const hasViewed = story.viewers.some((v) => v.userId.toString() === currentUserId.toString());

      storiesByUser[storyUserId].stories.push({
        ...story,
        user: story.userId,
        hasViewed,
        timestamp: getTimeAgo(story.createdAt),
      });

      if (!hasViewed) storiesByUser[storyUserId].hasUnviewed = true;
    });

    // Unviewed stories first
    return Object.values(storiesByUser).sort((a, b) => {
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });
  }

  async getUserStories(userId, currentUserId) {
    const stories = await storyDAO.findActiveByUser(userId);

    return stories.map((story) => ({
      ...story,
      user: story.userId,
      hasViewed: story.viewers.some((v) => v.userId.toString() === currentUserId.toString()),
      timestamp: getTimeAgo(story.createdAt),
    }));
  }

  async viewStory(storyId, viewerId) {
    const story = await storyDAO.findById(storyId);
    if (!story) throw new AppError("Story not found", 404);

    // Không tính lượt xem của chính tác giả
    if (story.userId.toString() === viewerId.toString()) {
      return { viewsCount: story.viewsCount };
    }

    const updated = await storyDAO.recordView(storyId, viewerId);
    return { viewsCount: updated ? updated.viewsCount : story.viewsCount };
  }

  async deleteStory(storyId, userId) {
    const story = await storyDAO.findById(storyId);
    if (!story) throw new AppError("Story not found", 404);
    if (story.userId.toString() !== userId.toString()) {
      throw new AppError("Not authorized to delete this story", 403);
    }

    await storyDAO.deleteById(storyId);
  }

  async getStoryViewers(storyId) {
    const story = await storyDAO.findWithViewers(storyId);
    if (!story) throw new AppError("Story not found", 404);

    return {
      viewers: story.viewers.map((v) => ({ user: v.userId, viewedAt: v.viewedAt })),
      totalViews: story.viewsCount,
    };
  }
}

module.exports = new StoryService();
