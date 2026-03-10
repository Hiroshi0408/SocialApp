const Save = require("../models/Save");
const Post = require("../models/Post");
const Like = require("../models/Like");
const { getTimeAgo } = require("../utils/timeHelper");
const { DEFAULT_POST_LIMIT, MAX_POST_LIMIT } = require("../constants");
const mongoose = require("mongoose");

// [POST] /api/saves/:postId - Save a post
exports.savePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    console.log(`Save post - User: ${req.user.username}, Post: ${postId}`);

    const post = await Post.findOne({ _id: postId, deleted: false });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const existingSave = await Save.findOne({ userId, postId });
    if (existingSave) {
      return res.status(400).json({
        success: false,
        message: "Post already saved",
      });
    }

    const save = new Save({ userId, postId });
    await save.save();

    await Post.findByIdAndUpdate(postId, { $inc: { savesCount: 1 } });

    console.log(`Post saved - ID: ${postId}`);

    res.json({
      success: true,
      message: "Post saved successfully",
      isSaved: true,
    });
  } catch (error) {
    console.error("Save post error:", error);

    if (error.code === 11000) {
      return res.json({
        success: true,
        message: "Post already saved",
        isSaved: true,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to save post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [DELETE] /api/saves/:postId - Unsave a post
exports.unsavePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    console.log(`Unsave post - User: ${req.user.username}, Post: ${postId}`);

    const save = await Save.findOneAndDelete({ userId, postId });

    if (!save) {
      return res.status(404).json({
        success: false,
        message: "Post not saved",
      });
    }

    await Post.findByIdAndUpdate(postId, [
      {
        $set: {
          savesCount: { $max: [0, { $subtract: ["$savesCount", 1] }] },
        },
      },
    ]);

    console.log(`Post unsaved - ID: ${postId}`);

    res.json({
      success: true,
      message: "Post unsaved successfully",
      isSaved: false,
    });
  } catch (error) {
    console.error("Unsave post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsave post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/saves - Get all saved posts
exports.getSavedPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT
    );
    const skip = (page - 1) * limit;

    console.log(`Get saved posts - User: ${req.user.username}`);

    const saves = await Save.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "postId",
        match: { deleted: false },
        populate: {
          path: "userId",
          select: "username fullName avatar",
        },
      })
      .lean();

    const posts = saves
      .filter((save) => save.postId)
      .map((save) => save.postId);

    const postIds = posts.map((p) => p._id);
    const likes = await Like.find({
      userId,
      targetId: { $in: postIds },
      targetType: "post",
    }).select("targetId");

    const likedPostIds = new Set(likes.map((l) => l.targetId.toString()));

    const postsWithMetadata = posts.map((post) => ({
      ...post,
      user: post.userId,
      likes: post.likesCount,
      comments: post.commentsCount,
      isLiked: likedPostIds.has(post._id.toString()),
      isSaved: true,
      timestamp: getTimeAgo(post.createdAt),
      commentsList: [],
    }));

    const totalResult = await Save.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "posts",
          localField: "postId",
          foreignField: "_id",
          as: "post"
        }
      },
      { $unwind: "$post" },
      { $match: { "post.deleted": false } },
      { $count: "total" }
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    res.json({
      success: true,
      posts: postsWithMetadata,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + postsWithMetadata.length < total,
      },
    });
  } catch (error) {
    console.error("Get saved posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get saved posts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/saves/:postId/status - Check if post is saved
exports.checkSaveStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const save = await Save.findOne({ userId, postId });

    res.json({
      success: true,
      isSaved: !!save,
    });
  } catch (error) {
    console.error("Check save status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check save status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
