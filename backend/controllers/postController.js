const postService = require("../services/postService");
const logger = require("../utils/logger");

// [GET] /api/posts/feed
exports.getFeed = async (req, res, next) => {
  try {
    logger.info(
      `Get feed - User: ${req.user.username}, Scope: ${req.query.scope || "following"}`,
    );
    const result = await postService.getFeed(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/posts
exports.getAllPosts = async (req, res, next) => {
  try {
    const result = await postService.getAllPosts(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/posts/:id
exports.getPostById = async (req, res, next) => {
  try {
    logger.info(`Get post by ID: ${req.params.id}`);
    const post = await postService.getPostById(req.params.id, req.user.id);
    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/posts
exports.createPost = async (req, res, next) => {
  try {
    logger.info(`Create post - User: ${req.user.username}`);
    const post = await postService.createPost(req.user.id, req.body);
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
        likes: post.likesCount,
        comments: post.commentsCount,
        isLiked: false,
        isSaved: false,
        timestamp: "Just now",
        commentsList: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// [PUT] /api/posts/:id
exports.updatePost = async (req, res, next) => {
  try {
    logger.info(`Update post - ID: ${req.params.id}`);
    const post = await postService.updatePost(
      req.params.id,
      req.user.id,
      req.body,
    );
    res.json({
      success: true,
      message: "Post updated successfully",
      post: { ...post.toJSON(), user: post.userId },
    });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/posts/:id
exports.deletePost = async (req, res, next) => {
  try {
    logger.info(`Delete post - ID: ${req.params.id}`);
    await postService.deletePost(req.params.id, req.user.id);
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/posts/:id/like
exports.toggleLike = async (req, res, next) => {
  try {
    logger.info(
      `Toggle like - Post: ${req.params.id}, User: ${req.user.username}`,
    );
    const result = await postService.toggleLike(req.params.id, req.user.id);
    res.json({
      success: true,
      message: result.isLiked ? "Post liked" : "Post unliked",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/posts/search/hashtag
exports.searchByHashtag = async (req, res, next) => {
  try {
    logger.info(`Search posts by hashtag: ${req.query.q}`);
    const result = await postService.searchByHashtag(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/posts/tagged  /  /api/posts/tagged/:userId
exports.getTaggedPosts = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId || req.user.id;
    logger.info(`Get tagged posts - User: ${targetUserId}`);
    const result = await postService.getTaggedPosts(
      targetUserId,
      req.user.id,
      req.query,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};
