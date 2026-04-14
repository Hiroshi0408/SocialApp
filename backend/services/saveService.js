const saveDAO = require("../dao/saveDAO");
const postDAO = require("../dao/postDAO");
const likeDAO = require("../dao/likeDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { DEFAULT_POST_LIMIT, MAX_POST_LIMIT } = require("../constants");

class SaveService {
  async savePost(userId, postId) {
    const post = await postDAO.findById(postId);
    if (!post) throw new AppError("Post not found", 404);

    try {
      await saveDAO.create(userId, postId);
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate — idempotent, trả về success
        return { isSaved: true };
      }
      throw error;
    }

    await postDAO.updateById(postId, { $inc: { savesCount: 1 } });
    logger.info(`Post saved - ID: ${postId}`);
    return { isSaved: true };
  }

  async unsavePost(userId, postId) {
    const save = await saveDAO.deleteOne(userId, postId);
    if (!save) throw new AppError("Post not saved", 404);

    await postDAO.updateById(postId, [
      { $set: { savesCount: { $max: [0, { $subtract: ["$savesCount", 1] }] } } },
    ]);

    logger.info(`Post unsaved - ID: ${postId}`);
    return { isSaved: false };
  }

  async getSavedPosts(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;

    const [saves, total] = await Promise.all([
      saveDAO.findByUser(userId, { skip, limit }),
      saveDAO.countByUser(userId),
    ]);

    const posts = saves.filter((s) => s.postId).map((s) => s.postId);
    const postIds = posts.map((p) => p._id);

    const likes = await likeDAO.findByUserAndTargets(userId, postIds, "post");
    const likedSet = new Set(likes.map((l) => l.targetId.toString()));

    const postsWithMetadata = posts.map((post) => ({
      ...post,
      user: post.userId,
      likes: post.likesCount,
      comments: post.commentsCount,
      isLiked: likedSet.has(post._id.toString()),
      isSaved: true,
      timestamp: getTimeAgo(post.createdAt),
      commentsList: [],
    }));

    return {
      posts: postsWithMetadata,
      pagination: { page, limit, total, hasMore: skip + postsWithMetadata.length < total },
    };
  }

  async checkSaveStatus(userId, postId) {
    const save = await saveDAO.findOne(userId, postId);
    return { isSaved: !!save };
  }
}

module.exports = new SaveService();
