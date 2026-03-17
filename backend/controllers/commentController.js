const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Like = require("../models/Like");
const Notification = require("../models/Notification");
const { createNotification } = require("./notificationController");
const logger = require("../utils/logger.js");
const mongoose = require("mongoose");
const { getTimeAgo } = require("../utils/timeHelper");
//[DELETE] /api/comments/:id - Delete Comment
exports.deleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    logger.info(
      ` Delete comment - Comment: ${commentId}, User: ${req.user.username}`,
    );

    // Find comment
    const comment = await Comment.findOne({
      _id: commentId,
      deleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check authorization - only comment owner can delete
    if (comment.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this comment",
      });
    }

    // Find all child replies (recursive)
    const childComments = await Comment.aggregate([
      {
        $graphLookup: {
          from: "comments",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentCommentId",
          as: "descendants",
          restrictSearchWithMatch: { deleted: false },
        },
      },
      { $match: { _id: new mongoose.Types.ObjectId(commentId) } },
    ]).then((res) => res[0]?.descendants || []);
    const totalCommentsToDelete = 1 + childComments.length;
    const allCommentIds = [commentId, ...childComments.map((c) => c._id)];

    logger.info(` Deleting comment and ${childComments.length} child replies`);

    // Soft delete comment and all children
    const deletedAt = new Date();
    await Comment.updateOne(
      { _id: commentId },
      { $set: { deleted: true, deletedAt } },
    );

    if (childComments.length > 0) {
      await Comment.updateMany(
        { _id: { $in: childComments.map((c) => c._id) } },
        { $set: { deleted: true, deletedAt } },
      );
    }

    // Cleanup related data
    await Promise.all([
      // Delete all likes on these comments
      Like.deleteMany({
        targetId: { $in: allCommentIds },
        targetType: "comment",
      }),
      // Delete all notifications related to these comments
      Notification.deleteMany({
        targetId: { $in: allCommentIds },
        targetType: "comment",
      }),
    ]);

    // Decrement post's comments count (prevent negative)
    await Post.findByIdAndUpdate(comment.postId, [
      {
        $set: {
          commentsCount: {
            $max: [0, { $subtract: ["$commentsCount", totalCommentsToDelete] }],
          },
        },
      },
    ]);

    // If this is a reply, decrement parent comment's replies count by 1 (prevent negative)
    if (comment.parentCommentId) {
      await Comment.findByIdAndUpdate(comment.parentCommentId, [
        {
          $set: {
            repliesCount: { $max: [0, { $subtract: ["$repliesCount", 1] }] },
          },
        },
      ]);
    }

    logger.info(
      `Comment deleted - ID: ${commentId}, Total deleted: ${totalCommentsToDelete}`,
    );

    res.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    logger.error(" Delete comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/comments/:id/replies - Get Comment Replies
exports.getCommentReplies = async (req, res) => {
  try {
    const { id: commentId } = req.params;
    const userId = req.user.id;

    logger.info(` Get comment replies - Comment: ${commentId}`);

    // Check if parent comment exists
    const parentComment = await Comment.findOne({
      _id: commentId,
      deleted: false,
    });

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Get replies
    const replies = await Comment.find({
      parentCommentId: commentId,
      deleted: false,
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: 1 }) // Oldest first for replies
      .lean();

    // Check if user has liked each reply
    const replyIds = replies.map((r) => r._id);
    const likes = await Like.find({
      userId,
      targetId: { $in: replyIds },
      targetType: "comment",
    }).select("targetId");

    const likedReplyIds = new Set(likes.map((l) => l.targetId.toString()));

    // Format replies
    const formattedReplies = replies.map((reply) => ({
      ...reply,
      user: reply.userId,
      isLiked: likedReplyIds.has(reply._id.toString()),
      timestamp: getTimeAgo(reply.createdAt),
    }));

    res.json({
      success: true,
      replies: formattedReplies,
    });
  } catch (error) {
    logger.error(" Get comment replies error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comment replies",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/comments/:id/like - Toggle Comment Like
exports.toggleCommentLike = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user.id;

    logger.info(
      ` Toggle comment like - Comment: ${commentId}, User: ${req.user.username}`,
    );

    // Check if comment exists
    const comment = await Comment.findOne({
      _id: commentId,
      deleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      userId,
      targetId: commentId,
      targetType: "comment",
    });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Comment.findByIdAndUpdate(commentId, [
        {
          $set: {
            likesCount: { $max: [0, { $subtract: ["$likesCount", 1] }] },
          },
        },
      ]);

      // Delete notification
      await Notification.findOneAndDelete({
        senderId: userId,
        targetId: commentId,
        type: "like",
      });

      logger.info(` Comment unliked - ID: ${commentId}`);

      return res.json({
        success: true,
        message: "Comment unliked",
        isLiked: false,
        likesCount: Math.max(0, comment.likesCount - 1),
      });
    } else {
      // Like
      const like = new Like({
        userId,
        targetType: "comment",
        targetId: commentId,
      });

      await like.save();
      await Comment.findByIdAndUpdate(commentId, {
        $inc: { likesCount: 1 },
      });

      logger.info(` Comment liked - ID: ${commentId}`);

      // Create notification for comment owner
      await createNotification({
        recipientId: comment.userId,
        senderId: userId,
        type: "like",
        targetType: "comment",
        targetId: commentId,
      });

      return res.json({
        success: true,
        message: "Comment liked",
        isLiked: true,
        likesCount: comment.likesCount + 1,
      });
    }
  } catch (error) {
    logger.error(" Toggle comment like error:", error);

    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Like already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to toggle comment like",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
