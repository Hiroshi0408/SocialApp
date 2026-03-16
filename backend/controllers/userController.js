const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const Like = require("../models/Like");
const Save = require("../models/Save");
const { getTimeAgo } = require("../utils/timeHelper");
const { createNotification } = require("./notificationController");
const { formatPostsWithMetadata } = require("../helpers/postHelper");
const logger = require("../utils/logger.js");
const {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_USER_LIMIT,
  MAX_USER_LIMIT,
  DEFAULT_SUGGESTED_USERS_LIMIT,
} = require("../constants");

//[GET] /api/users/:username
exports.getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.id;

    logger.info(`Get user profile: ${username}`);

    const user = await User.findOne({
      username,
      deleted: false,
      status: "active",
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isFollowing = await Follow.findOne({
      follower: currentUserId,
      following: user._id,
    });

    res.json({
      success: true,
      user: {
        ...user.toJSON(),
        isFollowing: !!isFollowing,
        isOwnProfile: user._id.toString() === currentUserId,
      },
    });
  } catch (error) {
    logger.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/:userId/posts
exports.getUserPosts = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      MAX_POST_LIMIT,
    );
    const skip = (page - 1) * limit;
    const currentUserId = req.user.id;

    logger.info(`Get user posts - User: ${userId}`);

    const posts = await Post.find({
      userId,
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

    const total = await Post.countDocuments({ userId, deleted: false });

    res.json({
      success: true,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + formattedPosts.length < total,
      },
    });
  } catch (error) {
    logger.error("Get user posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user posts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/users/:userId/follow
exports.followUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    logger.info(
      `Follow user - Follower: ${req.user.username}, Following: ${userId}`,
    );

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Cannot follow yourself",
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const existingFollow = await Follow.findOne({
      follower: currentUserId,
      following: userId,
    });

    if (existingFollow) {
      return res.status(400).json({
        success: false,
        message: "Already following this user",
      });
    }

    const follow = new Follow({
      follower: currentUserId,
      following: userId,
    });

    await follow.save();

    await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: 1 } }),
      User.findByIdAndUpdate(userId, { $inc: { followersCount: 1 } }),
    ]);

    logger.info(`User followed - ID: ${userId}`);

    await createNotification({
      recipientId: userId,
      senderId: currentUserId,
      type: "follow",
      targetType: "user",
      targetId: currentUserId,
    });

    res.json({
      success: true,
      message: "User followed successfully",
    });
  } catch (error) {
    logger.error("Follow user error:", error);

    if (error.code === 11000) {
      return res.json({
        success: true,
        message: "Already following this user",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to follow user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[DELETE] /api/users/:userId/follow
exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    logger.info(
      `Unfollow user - Follower: ${req.user.username}, Following: ${userId}`,
    );

    const follow = await Follow.findOneAndDelete({
      follower: currentUserId,
      following: userId,
    });

    if (!follow) {
      return res.status(404).json({
        success: false,
        message: "Not following this user",
      });
    }

    await Promise.all([
      User.findByIdAndUpdate(currentUserId, [
        {
          $set: {
            followingCount: {
              $max: [0, { $subtract: ["$followingCount", 1] }],
            },
          },
        },
      ]),
      User.findByIdAndUpdate(userId, [
        {
          $set: {
            followersCount: {
              $max: [0, { $subtract: ["$followersCount", 1] }],
            },
          },
        },
      ]),
    ]);

    logger.info(`User unfollowed - ID: ${userId}`);

    res.json({
      success: true,
      message: "User unfollowed successfully",
    });
  } catch (error) {
    logger.error("Unfollow user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unfollow user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/suggestions
exports.getSuggestedUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_SUGGESTED_USERS_LIMIT,
      MAX_USER_LIMIT,
    );

    logger.info(`Get suggested users - User: ${req.user.username}`);

    const following = await Follow.find({ follower: currentUserId }).select(
      "following",
    );
    const followingIds = following.map((f) => f.following);

    const suggestedUsers = await User.find({
      _id: { $nin: [...followingIds, currentUserId] },
      deleted: false,
      status: "active",
    })
      .select("username fullName avatar followersCount")
      .sort({ followersCount: -1 })
      .limit(limit)
      .lean();

    const users = suggestedUsers.map((user) => ({
      ...user,
      isFollowing: false,
      subtitle: `${user.followersCount} followers`,
    }));

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    logger.error("Get suggested users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get suggested users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/search
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(`Search users - Query: ${q}`);

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const searchRegex = new RegExp(q.trim(), "i");

    const users = await User.find({
      $or: [{ username: searchRegex }, { fullName: searchRegex }],
      deleted: false,
      status: "active",
    })
      .select("username fullName avatar followersCount")
      .sort({ followersCount: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments({
      $or: [{ username: searchRegex }, { fullName: searchRegex }],
      deleted: false,
      status: "active",
    });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    logger.error("Search users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/:userId/followers
exports.getFollowers = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(`Get followers - User: ${userId}`);

    const followers = await Follow.find({ following: userId })
      .populate("follower", "username fullName avatar followersCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const users = followers.map((f) => f.follower);

    const total = await Follow.countDocuments({ following: userId });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    logger.error("Get followers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get followers",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/:userId/following
exports.getFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(
      parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    logger.info(`Get following - User: ${userId}`);

    const following = await Follow.find({ follower: userId })
      .populate("following", "username fullName avatar followersCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const users = following.map((f) => f.following);

    const total = await Follow.countDocuments({ follower: userId });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    logger.error("Get following error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get following",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[PUT] /api/users/profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, bio, website } = req.body;

    logger.info(`Update profile - User: ${req.user.username}`);

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;

    await user.save();

    logger.info(`Profile updated - User: ${user.username}`);

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Update profile error:", error);

    if (error.name === "ValidationError") {
      const errors = {};
      Object.keys(error.errors).forEach((key) => {
        errors[key] = error.errors[key].message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/users/avatar
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatar } = req.body;

    logger.info(`Upload avatar - User: ${req.user.username}`);

    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "Avatar URL is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar },
      { new: true },
    );

    logger.info(`Avatar updated - User: ${user.username}`);

    res.json({
      success: true,
      message: "Avatar updated successfully",
      avatarUrl: user.avatar,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[GET] /api/users/:userId/follow-status
exports.checkFollowStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const isFollowing = await Follow.findOne({
      follower: currentUserId,
      following: userId,
    });

    res.json({
      success: true,
      isFollowing: !!isFollowing,
    });
  } catch (error) {
    logger.error("Check follow status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check follow status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
