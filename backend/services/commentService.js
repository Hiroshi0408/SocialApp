const commentDAO = require("../dao/commentDAO");
const postDAO = require("../dao/postDAO");
const likeDAO = require("../dao/likeDAO");
const notificationDAO = require("../dao/notificationDAO");
const notificationService = require("./notificationService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { extractMentions, validateMentions } = require("../utils/mentionHelper");
const { moderateText } = require("./geminiModeration");
const {
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  MAX_COMMENT_DEPTH,
} = require("../constants");

class CommentService {
  async addComment(userId, postId, data) {
    const { text, parentCommentId } = data;

    if (!text || !text.trim()) {
      throw new AppError("Comment text is required", 400);
    }

    const moderation = await moderateText(text);
    if (!moderation.allowed) {
      throw new AppError("Comment violates community guidelines", 400, {
        moderation: {
          verdict: moderation.verdict,
          reasons: moderation.reasons,
          categories: moderation.categories,
        },
      });
    }

    const post = await postDAO.findById(postId);
    if (!post) throw new AppError("Post not found", 404);
    if (!post.allowComments)
      throw new AppError("Comments are disabled for this post", 403);

    if (parentCommentId) {
      const parentComment = await commentDAO.findById(parentCommentId);
      if (
        !parentComment ||
        parentComment.postId.toString() !== postId.toString()
      ) {
        throw new AppError(
          "Parent comment not found or belongs to different post",
          404,
        );
      }

      // Kiểm tra độ sâu lồng nhau
      let depth = 1;
      let currentComment = parentComment;
      while (currentComment.parentCommentId && depth < MAX_COMMENT_DEPTH + 1) {
        currentComment = await commentDAO.findById(
          currentComment.parentCommentId,
        );
        if (!currentComment) break;
        depth++;
      }

      if (depth >= MAX_COMMENT_DEPTH) {
        throw new AppError(
          `Maximum comment nesting depth (${MAX_COMMENT_DEPTH}) reached`,
          400,
        );
      }

      await commentDAO.incrementRepliesCount(parentCommentId);
    }

    const mentions = extractMentions(text);
    const comment = await commentDAO.create({
      userId,
      postId,
      text: text.trim(),
      mentions,
      parentCommentId: parentCommentId || null,
    });

    await postDAO.incrementCommentsCount(postId);
    await comment.populate("userId", "username fullName avatar");

    // Notification: post owner
    notificationService
      .createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: "comment",
        targetType: "post",
        targetId: postId,
        text: text.trim().substring(0, 100),
      })
      .catch((err) =>
        logger.error("Comment notification failed:", err.message),
      );

    // Notification: mentions trong comment
    if (mentions.length > 0) {
      const mentionedUsers = await validateMentions(mentions);
      for (const mentionedUser of mentionedUsers) {
        if (
          mentionedUser._id.toString() !== userId.toString() &&
          mentionedUser._id.toString() !== post.userId.toString()
        ) {
          notificationService
            .createNotification({
              recipientId: mentionedUser._id,
              senderId: userId,
              type: "mention",
              targetType: "comment",
              targetId: comment._id,
              text: text.trim().substring(0, 100),
            })
            .catch((err) =>
              logger.error("Mention notification failed:", err.message),
            );
        }
      }
    }

    return comment;
  }

  async getComments(postId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(
      parseInt(query.limit) || DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      commentDAO.findByPost(postId, { skip, limit }),
      commentDAO.count({ postId, parentCommentId: null }),
    ]);

    return {
      comments: comments.map((c) => ({
        ...c,
        user: c.userId,
        timestamp: getTimeAgo(c.createdAt),
      })),
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + comments.length < total,
      },
    };
  }

  async deleteComment(commentId, userId) {
    const comment = await commentDAO.findById(commentId);

    if (!comment) throw new AppError("Comment not found", 404);
    if (comment.userId.toString() !== userId.toString()) {
      throw new AppError("You are not authorized to delete this comment", 403);
    }

    const childComments = await commentDAO.findDescendants(commentId);
    const totalToDelete = 1 + childComments.length;
    const allIds = [commentId, ...childComments.map((c) => c._id)];

    const deletedAt = new Date();
    await commentDAO.softDeleteById(commentId);

    if (childComments.length > 0) {
      await commentDAO.softDeleteMany({
        _id: { $in: childComments.map((c) => c._id) },
      });
    }

    await Promise.all([
      likeDAO.deleteManyByTarget({ $in: allIds }, "comment"),
      notificationDAO.deleteMany({
        targetId: { $in: allIds },
        targetType: "comment",
      }),
      postDAO.decrementCommentsCount(comment.postId, totalToDelete),
    ]);

    if (comment.parentCommentId) {
      await commentDAO.decrementRepliesCount(comment.parentCommentId);
    }

    logger.info(
      `Comment deleted - ID: ${commentId}, Total deleted: ${totalToDelete}`,
    );
  }

  async getCommentReplies(commentId, userId) {
    const parentComment = await commentDAO.findById(commentId);
    if (!parentComment) throw new AppError("Comment not found", 404);

    const replies = await commentDAO.findReplies(commentId);
    const replyIds = replies.map((r) => r._id);

    const likes = await likeDAO.findByUserAndTargets(
      userId,
      replyIds,
      "comment",
    );
    const likedSet = new Set(likes.map((l) => l.targetId.toString()));

    return replies.map((reply) => ({
      ...reply,
      user: reply.userId,
      isLiked: likedSet.has(reply._id.toString()),
      timestamp: getTimeAgo(reply.createdAt),
    }));
  }

  async toggleCommentLike(commentId, userId) {
    const comment = await commentDAO.findById(commentId);
    if (!comment) throw new AppError("Comment not found", 404);

    const existingLike = await likeDAO.findOne({
      userId,
      targetId: commentId,
      targetType: "comment",
    });

    if (existingLike) {
      await likeDAO.deleteById(existingLike._id);
      await commentDAO.decrementLikesCount(commentId);
      await notificationDAO.deleteOne({
        senderId: userId,
        targetId: commentId,
        type: "like",
      });

      return {
        isLiked: false,
        likesCount: Math.max(0, comment.likesCount - 1),
      };
    } else {
      try {
        await likeDAO.create({
          userId,
          targetId: commentId,
          targetType: "comment",
        });
      } catch (error) {
        if (error.code === 11000) {
          return { isLiked: true, likesCount: comment.likesCount };
        }
        throw error;
      }

      await commentDAO.incrementLikesCount(commentId);

      notificationService
        .createNotification({
          recipientId: comment.userId,
          senderId: userId,
          type: "like",
          targetType: "comment",
          targetId: commentId,
        })
        .catch((err) =>
          logger.error("Comment like notification failed:", err.message),
        );

      return { isLiked: true, likesCount: comment.likesCount + 1 };
    }
  }
}

module.exports = new CommentService();
