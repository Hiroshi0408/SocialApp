const userService = require("../services/userService");
const logger = require("../utils/logger");
const {
  DEFAULT_POST_LIMIT,
  DEFAULT_USER_LIMIT,
  DEFAULT_SUGGESTED_USERS_LIMIT,
} = require("../constants");

//[GET] /api/users/:username
exports.getUserProfile = async (req, res, next) => {
  try {
    logger.info(`Get user profile: ${req.params.username}`);
    const result = await userService.getUserProfile(
      req.params.username,
      req.user.id
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/:userId/posts
exports.getUserPosts = async (req, res, next) => {
  try {
    logger.info(`Get user posts - User: ${req.params.userId}`);
    const result = await userService.getUserPosts(
      req.params.userId,
      req.user.id,
      {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || DEFAULT_POST_LIMIT,
      }
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/users/:userId/follow
exports.followUser = async (req, res, next) => {
  try {
    logger.info(
      `Follow user - Follower: ${req.user.username}, Following: ${req.params.userId}`
    );
    const result = await userService.followUser(req.user.id, req.params.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[DELETE] /api/users/:userId/follow
exports.unfollowUser = async (req, res, next) => {
  try {
    logger.info(
      `Unfollow user - Follower: ${req.user.username}, Following: ${req.params.userId}`
    );
    const result = await userService.unfollowUser(
      req.user.id,
      req.params.userId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/suggestions
exports.getSuggestedUsers = async (req, res, next) => {
  try {
    logger.info(`Get suggested users - User: ${req.user.username}`);
    const result = await userService.getSuggestedUsers(
      req.user.id,
      parseInt(req.query.limit) || DEFAULT_SUGGESTED_USERS_LIMIT
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/search
exports.searchUsers = async (req, res, next) => {
  try {
    logger.info(`Search users - Query: ${req.query.q}`);
    const result = await userService.searchUsers(req.query.q, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/:userId/followers
exports.getFollowers = async (req, res, next) => {
  try {
    logger.info(`Get followers - User: ${req.params.userId}`);
    const result = await userService.getFollowers(req.params.userId, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/:userId/following
exports.getFollowing = async (req, res, next) => {
  try {
    logger.info(`Get following - User: ${req.params.userId}`);
    const result = await userService.getFollowing(req.params.userId, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || DEFAULT_USER_LIMIT,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[PUT] /api/users/profile
exports.updateProfile = async (req, res, next) => {
  try {
    logger.info(`Update profile - User: ${req.user.username}`);
    const { fullName, bio, website } = req.body;
    const result = await userService.updateProfile(req.user.id, {
      fullName,
      bio,
      website,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[POST] /api/users/avatar
exports.uploadAvatar = async (req, res, next) => {
  try {
    logger.info(`Upload avatar - User: ${req.user.username}`);
    const result = await userService.uploadAvatar(req.user.id, req.body.avatar);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

//[GET] /api/users/:userId/follow-status
exports.checkFollowStatus = async (req, res, next) => {
  try {
    const result = await userService.checkFollowStatus(
      req.user.id,
      req.params.userId
    );
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};
