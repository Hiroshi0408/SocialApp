const commentService = require("../services/commentService");
const logger = require("../utils/logger");

// [POST] /api/posts/:id/comments - Add Comment (route mount từ post.route.js)
exports.addComment = async (req, res, next) => {
  try {
    logger.info(`Add comment - Post: ${req.params.id}, User: ${req.user.username}`);
    const comment = await commentService.addComment(req.user.id, req.params.id, req.body);
    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: { ...comment.toJSON(), user: comment.userId, timestamp: "Just now" },
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/posts/:id/comments - Get Comments (route mount từ post.route.js)
exports.getComments = async (req, res, next) => {
  try {
    logger.info(`Get comments - Post: ${req.params.id}`);
    const result = await commentService.getComments(req.params.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/comments/:id
exports.deleteComment = async (req, res, next) => {
  try {
    logger.info(`Delete comment - Comment: ${req.params.id}, User: ${req.user.username}`);
    await commentService.deleteComment(req.params.id, req.user.id);
    res.json({ success: true, message: "Comment deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/comments/:id/replies
exports.getCommentReplies = async (req, res, next) => {
  try {
    logger.info(`Get comment replies - Comment: ${req.params.id}`);
    const replies = await commentService.getCommentReplies(req.params.id, req.user.id);
    res.json({ success: true, replies });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/comments/:id/like
exports.toggleCommentLike = async (req, res, next) => {
  try {
    logger.info(`Toggle comment like - Comment: ${req.params.id}, User: ${req.user.username}`);
    const result = await commentService.toggleCommentLike(req.params.id, req.user.id);
    res.json({
      success: true,
      message: result.isLiked ? "Comment liked" : "Comment unliked",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
