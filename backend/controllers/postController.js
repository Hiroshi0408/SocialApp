const Post = require("../models/Post");
const User = require("../models/User");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const Save = require("../models/Save");
const Notification = require("../models/Notification");
const { getTimeAgo } = require("../utils/timeHelper");
const { createNotification } = require("./notificationController");
const {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
  MAX_COMMENT_LIMIT,
  MAX_COMMENT_DEPTH,
} = require("../constants");
const { extractMentions, validateMentions } = require("../utils/mentionHelper");
const Follow = require("../models/Follow");
const Friendship = require("../models/Friendship");
const { moderateText } = require("../services/geminiModeration");
const { formatPostsWithMetadata } = require("../helpers/postHelper");
const logger = require("../utils/logger.js");

// Get feed posts from followed users
exports.getFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const userId = req.user.id;
    const scope = req.query.scope === "friends" ? "friends" : "following";

    logger.info(
      ` Get feed - User: ${req.user.username}, Page: ${page}, Scope: ${scope}`,
    );

    let targetUserIds = [];

    if (scope === "friends") {
      const friendships = await Friendship.find({
        $or: [{ userA: userId }, { userB: userId }],
      }).select("userA userB");

      targetUserIds = friendships.map((relation) =>
        relation.userA.toString() === userId ? relation.userB : relation.userA,
      );
    } else {
      const following = await Follow.find({ follower: userId }).select(
        "following",
      );
      targetUserIds = following.map((f) => f.following);
    }

    // Include own posts in feed
    targetUserIds.push(userId);

    // Get posts from selected relationship scope + self
    const posts = await Post.find({
      userId: { $in: targetUserIds },
      deleted: false,
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postIds = posts.map((p) => p._id);

    const [likes, saves] = await Promise.all([
      Like.find({
        userId,
        targetId: { $in: postIds },
        targetType: "post",
      }).select("targetId"),
      Save.find({
        userId,
        postId: { $in: postIds },
      }).select("postId"),
    ]);

    const likedPostIds = new Set(likes.map((l) => l.targetId.toString()));
    const savedPostIds = new Set(saves.map((s) => s.postId.toString()));

    const formattedPosts = formatPostsWithMetadata(
      posts,
      likedPostIds,
      savedPostIds,
    );

    const total = await Post.countDocuments({
      userId: { $in: targetUserIds },
      deleted: false,
    });

    logger.info(
      ` Feed: ${formattedPosts.length} posts from ${targetUserIds.length} users`,
    );

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + formattedPosts.length < total,
      },
    });
  } catch (error) {
    logger.error(" Get feed error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get feed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(` Get posts - Page: ${page}, Limit: ${limit}`);

    // Get posts with user info populated
    const posts = await Post.find({ deleted: false })
      .populate("userId", "username fullName avatar") // Populate user info
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean(); // Convert to plain JS object (faster)

    // Check which posts current user has liked
    const userId = req.user.id;
    const postIds = posts.map((p) => p._id);

    const [likes, saves] = await Promise.all([
      Like.find({
        userId,
        targetId: { $in: postIds },
        targetType: "post",
      }).select("targetId"),
      Save.find({
        userId,
        postId: { $in: postIds },
      }).select("postId"),
    ]);

    const likedPostIds = new Set(likes.map((l) => l.targetId.toString()));
    const savedPostIds = new Set(saves.map((s) => s.postId.toString()));

    const formattedPosts = formatPostsWithMetadata(
      posts,
      likedPostIds,
      savedPostIds,
    );

    // Total count for pagination
    const total = await Post.countDocuments({ deleted: false });

    logger.info(` Retrieved ${formattedPosts.length} posts`);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + formattedPosts.length < total,
      },
    });
  } catch (error) {
    logger.error(" Get posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get posts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/posts/:id - Get Single Post
exports.getPostById = async (req, res) => {
  try {
    const postId = req.params.id;

    logger.info(` Get post by ID: ${postId}`);

    const post = await Post.findOne({
      _id: postId,
      deleted: false,
    }).populate("userId", "username fullName avatar");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const [like, save, commentsData] = await Promise.all([
      Like.findOne({
        userId: req.user.id,
        targetId: postId,
        targetType: "post",
      }),
      Save.findOne({
        userId: req.user.id,
        postId: postId,
      }),
      Comment.find({
        postId: postId,
        deleted: false,
        parentCommentId: null,
      })
        .populate("userId", "username fullName avatar")
        .sort({ createdAt: -1 })
        .limit(DEFAULT_COMMENT_LIMIT)
        .lean(),
    ]);

    const formattedComments = commentsData.map((comment) => ({
      ...comment,
      user: comment.userId,
      timestamp: getTimeAgo(comment.createdAt),
    }));

    res.json({
      success: true,
      post: {
        ...post.toJSON(),
        user: post.userId,
        likes: post.likesCount,
        comments: post.commentsCount,
        isLiked: !!like,
        isSaved: !!save,
        timestamp: getTimeAgo(post.createdAt),
        commentsList: formattedComments,
      },
    });
  } catch (error) {
    logger.error(" Get post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/posts - Create Post
exports.createPost = async (req, res) => {
  try {
    const {
      image,
      video,
      mediaType,
      videoDuration,
      caption,
      location,
      taggedUsers,
    } = req.body;
    const userId = req.user.id;

    logger.info(`Create post - User: ${req.user.username} Caption: ${caption}`);

    if (!image && !video) {
      return res.status(400).json({
        success: false,
        message: "Image or video is required",
      });
    }

    const mentions = caption ? extractMentions(caption) : [];

    // --- Gemini moderation (caption) ---
    if (caption && caption.trim()) {
      try {
        const moderation = await moderateText(caption);
        if (!moderation.allowed) {
          return res.status(400).json({
            success: false,
            message: "Caption violates community guidelines",
            moderation: {
              verdict: moderation.verdict,
              reasons: moderation.reasons,
              categories: moderation.categories,
            },
          });
        }
      } catch (err) {
        logger.error(" Gemini moderation error (caption):", err);
        return res.status(500).json({
          success: false,
          message: "Moderation service unavailable",
          error:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
    }

    const post = new Post({
      userId,
      image: image || "",
      video: video || "",
      mediaType: mediaType || (video ? "video" : "image"),
      videoDuration: videoDuration || 0,
      caption: caption || "",
      location: location || "",
      mentions,
      taggedUsers: taggedUsers || [],
    });

    await post.save();

    // Increment user's posts count
    await User.findByIdAndUpdate(userId, {
      $inc: { postsCount: 1 },
    });

    // Populate user info
    await post.populate("userId", "username fullName avatar");

    logger.info(` Post created - ID: ${post._id}`);

    // Send mention notifications
    if (post.mentions && post.mentions.length > 0) {
      const mentionedUsers = await validateMentions(post.mentions, User);
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser._id.toString() !== userId) {
          await createNotification({
            recipientId: mentionedUser._id,
            senderId: userId,
            type: "mention",
            targetType: "post",
            targetId: post._id,
            text: (caption || "").substring(0, 100),
          });
        }
      }
    }

    if (post.taggedUsers && post.taggedUsers.length > 0) {
      for (const taggedUserId of post.taggedUsers) {
        if (taggedUserId.toString() !== userId) {
          await createNotification({
            recipientId: taggedUserId,
            senderId: userId,
            type: "mention",
            targetType: "post",
            targetId: post._id,
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: {
        ...post.toJSON(),
        user: {
          _id: post.userId._id,
          username: post.userId.username,
          fullName: post.userId.fullName,
          avatar: post.userId.avatar,
        },
        likes: post.likesCount, // Map likesCount -> likes
        comments: post.commentsCount, // Map commentsCount -> comments
        isLiked: false,
        isSaved: false,
        timestamp: "Just now",
        commentsList: [],
      },
    });
  } catch (error) {
    logger.error(" Create post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[PUT] /api/posts/:id - Update Post
exports.updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const { caption, location, taggedUsers } = req.body;
    const userId = req.user.id;

    logger.info(` Update post - ID: ${postId}`);

    const post = await Post.findOne({
      _id: postId,
      deleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this post",
      });
    }

    // --- Gemini moderation (caption update) ---
    if (caption !== undefined && caption && caption.trim()) {
      try {
        const moderation = await moderateText(caption);
        if (!moderation.allowed) {
          return res.status(400).json({
            success: false,
            message: "Caption violates community guidelines",
            moderation: {
              verdict: moderation.verdict,
              reasons: moderation.reasons,
              categories: moderation.categories,
            },
          });
        }
      } catch (err) {
        logger.error(" Gemini moderation error (caption update):", err);
        return res.status(500).json({
          success: false,
          message: "Moderation service unavailable",
          error:
            process.env.NODE_ENV === "development" ? err.message : undefined,
        });
      }
    }

    if (caption !== undefined) post.caption = caption;
    if (location !== undefined) post.location = location;
    if (taggedUsers !== undefined) post.taggedUsers = taggedUsers;

    await post.save();

    await post.populate("userId", "username fullName avatar");

    logger.info(` Post updated - ID: ${postId}`);

    res.json({
      success: true,
      message: "Post updated successfully",
      post: {
        ...post.toJSON(),
        user: post.userId,
      },
    });
  } catch (error) {
    logger.error(" Update post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[DELETE] /api/posts/:id - Delete Post
exports.deletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    logger.info(` Delete post - ID: ${postId}`);

    // Find post
    const post = await Post.findOne({
      _id: postId,
      deleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this post",
      });
    }

    // Soft delete post
    post.deleted = true;
    post.deletedAt = new Date();
    await post.save();

    // Cleanup related data
    const deletedAt = new Date();
    await Promise.all([
      // Soft delete all comments on this post
      Comment.updateMany(
        { postId, deleted: false },
        { $set: { deleted: true, deletedAt } },
      ),
      // Delete all likes on this post
      Like.deleteMany({ targetId: postId, targetType: "post" }),
      // Delete all saves of this post
      Save.deleteMany({ postId }),
      // Delete all notifications related to this post
      Notification.deleteMany({ targetId: postId, targetType: "post" }),
      // Decrement user's posts count
      User.findByIdAndUpdate(userId, { $inc: { postsCount: -1 } }),
    ]);

    logger.info(` Post deleted - ID: ${postId}`);

    res.json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    logger.error(" Delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/posts/:id/like - Toggle Like
exports.toggleLike = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    logger.info(` Toggle like - Post: ${postId}, User: ${req.user.username}`);

    // Check if post exists
    const post = await Post.findOne({
      _id: postId,
      deleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if already liked
    const existingLike = await Like.findOne({
      userId,
      targetId: postId,
      targetType: "post",
    });

    if (existingLike) {
      // Unlike
      await Like.deleteOne({ _id: existingLike._id });
      await Post.findByIdAndUpdate(postId, [
        {
          $set: {
            likesCount: { $max: [0, { $subtract: ["$likesCount", 1] }] },
          },
        },
      ]);

      // Delete notification
      await Notification.findOneAndDelete({
        senderId: userId,
        targetId: postId,
        type: "like",
      });

      logger.info(` Post unliked - ID: ${postId}`);

      return res.json({
        success: true,
        message: "Post unliked",
        isLiked: false,
        likesCount: Math.max(0, post.likesCount - 1),
      });
    } else {
      // Like
      const like = new Like({
        userId,
        targetType: "post",
        targetId: postId,
      });

      await like.save();
      await Post.findByIdAndUpdate(postId, {
        $inc: { likesCount: 1 },
      });

      logger.info(` Post liked - ID: ${postId}`);

      await createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: "like",
        targetType: "post",
        targetId: postId,
      });

      return res.json({
        success: true,
        message: "Post liked",
        isLiked: true,
        likesCount: post.likesCount + 1,
      });
    }
  } catch (error) {
    logger.error(" Toggle like error:", error);

    if (error.code === 11000) {
      const post = await Post.findById(postId);
      const isLiked = await Like.exists({
        userId,
        targetId: postId,
        targetType: "post",
      });
      return res.json({
        success: true,
        message: isLiked ? "Post already liked" : "Post already unliked",
        isLiked: !!isLiked,
        likesCount: post?.likesCount || 0,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to toggle like",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/posts/:id/comments - Add Comment
exports.addComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const { text, parentCommentId } = req.body;
    const userId = req.user.id;

    logger.info(` Add comment - Post: ${postId}, User: ${req.user.username}`);

    // Validation
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    // --- Gemini moderation (comment text) ---
    try {
      const moderation = await moderateText(text);
      if (!moderation.allowed) {
        return res.status(400).json({
          success: false,
          message: "Comment violates community guidelines",
          moderation: {
            verdict: moderation.verdict,
            reasons: moderation.reasons,
            categories: moderation.categories,
          },
        });
      }
    } catch (err) {
      logger.error(" Gemini moderation error (comment):", err);
      return res.status(500).json({
        success: false,
        message: "Moderation service unavailable",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }

    // Check if post exists
    const post = await Post.findOne({
      _id: postId,
      deleted: false,
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if comments are allowed
    if (!post.allowComments) {
      return res.status(403).json({
        success: false,
        message: "Comments are disabled for this post",
      });
    }

    // If replying to a comment, validate parent exists and check depth
    if (parentCommentId) {
      logger.info(
        ` Replying to comment: ${parentCommentId} on post: ${postId}`,
      );
      const parentComment = await Comment.findOne({
        _id: parentCommentId,
        postId: postId,
        deleted: false,
      });

      if (!parentComment) {
        logger.info(` Parent comment not found: ${parentCommentId}`);
        return res.status(404).json({
          success: false,
          message: "Parent comment not found or belongs to different post",
        });
      }
      logger.info(` Parent comment found: ${parentComment._id}`);

      // Check comment nesting depth
      let depth = 1;
      let currentComment = parentComment;
      while (currentComment.parentCommentId && depth < MAX_COMMENT_DEPTH + 1) {
        currentComment = await Comment.findById(currentComment.parentCommentId);
        if (!currentComment) break;
        depth++;
      }

      if (depth >= MAX_COMMENT_DEPTH) {
        return res.status(400).json({
          success: false,
          message: `Maximum comment nesting depth (${MAX_COMMENT_DEPTH}) reached`,
        });
      }

      // Increment parent comment's replies count
      await Comment.findByIdAndUpdate(parentCommentId, {
        $inc: { repliesCount: 1 },
      });
    }

    // Extract mentions from comment
    const mentions = extractMentions(text);

    // Create comment
    const comment = new Comment({
      userId,
      postId,
      text: text.trim(),
      mentions,
      parentCommentId: parentCommentId || null,
    });

    await comment.save();

    // Increment post's comments count
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentsCount: 1 },
    });

    await comment.populate("userId", "username fullName avatar");

    logger.info(` Comment added - ID: ${comment._id}`);

    await createNotification({
      recipientId: post.userId,
      senderId: userId,
      type: "comment",
      targetType: "post",
      targetId: postId,
      text: text.trim().substring(0, 100),
    });

    // Send mention notifications
    if (mentions.length > 0) {
      const mentionedUsers = await validateMentions(mentions, User);
      for (const mentionedUser of mentionedUsers) {
        if (
          mentionedUser._id.toString() !== userId &&
          mentionedUser._id.toString() !== post.userId.toString()
        ) {
          await createNotification({
            recipientId: mentionedUser._id,
            senderId: userId,
            type: "mention",
            targetType: "comment",
            targetId: comment._id,
            text: text.trim().substring(0, 100),
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: {
        ...comment.toJSON(),
        user: comment.userId,
        timestamp: "Just now",
      },
    });
  } catch (error) {
    logger.error(" Add comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add comment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/posts/:id/comments - Get Comments
exports.getComments = async (req, res) => {
  try {
    const postId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_COMMENT_LIMIT,
      MAX_COMMENT_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(` Get comments - Post: ${postId}`);

    // Get comments
    const comments = await Comment.find({
      postId,
      deleted: false,
      parentCommentId: null, // Only top-level comments
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Format comments
    const formattedComments = comments.map((comment) => ({
      ...comment,
      user: comment.userId,
      timestamp: getTimeAgo(comment.createdAt),
    }));

    const total = await Comment.countDocuments({
      postId,
      deleted: false,
      parentCommentId: null,
    });

    res.json({
      success: true,
      comments: formattedComments,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + formattedComments.length < total,
      },
    });
  } catch (error) {
    logger.error(" Get comments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get comments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/posts/search/hashtag - Search posts by hashtag
exports.searchByHashtag = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const userId = req.user.id;

    logger.info(`Search posts by hashtag: ${q}`);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    let searchTag = q.trim().toLowerCase();
    if (!searchTag.startsWith("#")) {
      searchTag = "#" + searchTag;
    }

    const posts = await Post.find({
      hashtags: searchTag,
      deleted: false,
    })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const postIds = posts.map((p) => p._id);

    const [likes, saves] = await Promise.all([
      Like.find({
        userId,
        targetId: { $in: postIds },
        targetType: "post",
      }).select("targetId"),
      Save.find({
        userId,
        postId: { $in: postIds },
      }).select("postId"),
    ]);

    const likedPostIds = new Set(likes.map((l) => l.targetId.toString()));
    const savedPostIds = new Set(saves.map((s) => s.postId.toString()));

    const formattedPosts = formatPostsWithMetadata(
      posts,
      likedPostIds,
      savedPostIds,
    );

    const total = await Post.countDocuments({
      hashtags: searchTag,
      deleted: false,
    });

    res.json({
      success: true,
      hashtag: searchTag,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + formattedPosts.length < total,
      },
    });
  } catch (error) {
    logger.error("Search hashtag error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search hashtag",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getTaggedPosts = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(`Get tagged posts - User: ${userId}, Page: ${page}`);

    const posts = await Post.find({
      taggedUsers: userId,
      deleted: false,
    })
      .populate("userId", "username fullName avatar")
      .populate("taggedUsers", "username fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const currentUserId = req.user.id;
    const postIds = posts.map((p) => p._id);

    const [likes, saves] = await Promise.all([
      Like.find({
        userId: currentUserId,
        targetId: { $in: postIds },
        targetType: "post",
      }).select("targetId"),
      Save.find({
        userId: currentUserId,
        postId: { $in: postIds },
      }).select("postId"),
    ]);

    const likedPostIds = new Set(likes.map((l) => l.targetId.toString()));
    const savedPostIds = new Set(saves.map((s) => s.postId.toString()));

    const formattedPosts = formatPostsWithMetadata(
      posts,
      likedPostIds,
      savedPostIds,
    );

    const total = await Post.countDocuments({
      taggedUsers: userId,
      deleted: false,
    });

    logger.info(`Retrieved ${formattedPosts.length} tagged posts`);

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + formattedPosts.length < total,
      },
    });
  } catch (error) {
    logger.error("Get tagged posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get tagged posts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
