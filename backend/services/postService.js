const postDAO = require("../dao/postDAO");
const likeDAO = require("../dao/likeDAO");
const saveDAO = require("../dao/saveDAO");
const userDAO = require("../dao/userDAO");
const commentDAO = require("../dao/commentDAO");
const followDAO = require("../dao/followDAO");
const friendDAO = require("../dao/friendDAO");
const notificationDAO = require("../dao/notificationDAO");
const notificationService = require("./notificationService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { getTimeAgo } = require("../utils/timeHelper");
const { validateMentions } = require("../utils/mentionHelper");
const { formatPostsWithMetadata } = require("../helpers/postHelper");
const { moderateText } = require("../utils/geminiModeration");
const {
  DEFAULT_POST_LIMIT,
  MAX_POST_LIMIT,
  DEFAULT_COMMENT_LIMIT,
} = require("../constants");

class PostService {
  // ========== FEED ==========

  async getFeed(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;
    const scope = query.scope === "friends" ? "friends" : "following";

    let targetUserIds = [];

    if (scope === "friends") {
      targetUserIds = await friendDAO.findFriendIds(userId);
    } else {
      targetUserIds = await followDAO.findFollowingIds(userId);
    }

    // Bao gồm bài của chính mình
    targetUserIds.push(userId);

    const filter = { userId: { $in: targetUserIds } };
    const populate = { path: "userId", select: "username fullName avatar" };

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  async getAllPosts(userId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;
    const populate = { path: "userId", select: "username fullName avatar" };

    const [posts, total] = await Promise.all([
      postDAO.findMany({}, { populate, skip, limit, lean: true }),
      postDAO.count({}),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }

  async getUserPosts(userId, currentUserId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;
    const populate = { path: "userId", select: "username fullName avatar" };

    const filter = { userId };
    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(currentUserId, postIds, "post"),
      saveDAO.findByUserAndPosts(currentUserId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    };
  }

  // ========== SINGLE POST ==========

  async getPostById(postId, currentUserId) {
    const post = await postDAO.findById(postId, {
      populate: { path: "userId", select: "username fullName avatar" },
    });

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const [like, save, commentsData] = await Promise.all([
      likeDAO.findOne({ userId: currentUserId, targetId: postId, targetType: "post" }),
      saveDAO.findOne({ userId: currentUserId, postId }),
      commentDAO.findByPost(postId, { limit: DEFAULT_COMMENT_LIMIT }),
    ]);

    const formattedComments = commentsData.map((c) => ({
      ...c,
      user: c.userId,
      timestamp: getTimeAgo(c.createdAt),
    }));

    return {
      ...post.toJSON(),
      user: post.userId,
      likes: post.likesCount,
      comments: post.commentsCount,
      isLiked: !!like,
      isSaved: !!save,
      timestamp: getTimeAgo(post.createdAt),
      commentsList: formattedComments,
    };
  }

  // ========== CRUD ==========

  async createPost(userId, data) {
    const { image, video, mediaType, videoDuration, caption, location, taggedUsers } = data;

    if (!image && !video) {
      throw new AppError("Image or video is required", 400);
    }

    if (caption && caption.trim()) {
      const moderation = await moderateText(caption);
      if (!moderation.allowed) {
        throw new AppError("Caption violates community guidelines", 400, {
          moderation: { verdict: moderation.verdict, reasons: moderation.reasons, categories: moderation.categories },
        });
      }
    }

    const post = await postDAO.create({
      userId,
      image: image || "",
      video: video || "",
      mediaType: mediaType || (video ? "video" : "image"),
      videoDuration: videoDuration || 0,
      caption: caption || "",
      location: location || "",
      taggedUsers: taggedUsers || [],
      // mentions và hashtags tự động extract từ caption bởi pre-save hook trong Post model
    });

    await userDAO.incrementPostsCount(userId);
    await post.populate({ path: "userId", select: "username fullName avatar" });

    // Mention notifications (fire-and-forget)
    if (post.mentions && post.mentions.length > 0) {
      const mentionedUsers = await validateMentions(post.mentions);
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser._id.toString() !== userId.toString()) {
          notificationService.createNotification({
            recipientId: mentionedUser._id,
            senderId: userId,
            type: "mention",
            targetType: "post",
            targetId: post._id,
            text: (caption || "").substring(0, 100),
          }).catch((err) => logger.error("Mention notification failed:", err.message));
        }
      }
    }

    if (post.taggedUsers && post.taggedUsers.length > 0) {
      for (const taggedUserId of post.taggedUsers) {
        if (taggedUserId.toString() !== userId.toString()) {
          notificationService.createNotification({
            recipientId: taggedUserId,
            senderId: userId,
            type: "mention",
            targetType: "post",
            targetId: post._id,
          }).catch((err) => logger.error("Tag notification failed:", err.message));
        }
      }
    }

    return post;
  }

  async updatePost(postId, userId, data) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.userId.toString() !== userId.toString()) {
      throw new AppError("You are not authorized to update this post", 403);
    }

    const { caption, location, taggedUsers } = data;

    if (caption !== undefined && caption && caption.trim()) {
      const moderation = await moderateText(caption);
      if (!moderation.allowed) {
        throw new AppError("Caption violates community guidelines", 400, {
          moderation: { verdict: moderation.verdict, reasons: moderation.reasons, categories: moderation.categories },
        });
      }
    }

    if (caption !== undefined) post.caption = caption;
    if (location !== undefined) post.location = location;
    if (taggedUsers !== undefined) post.taggedUsers = taggedUsers;

    await post.save();
    await post.populate({ path: "userId", select: "username fullName avatar" });

    return post;
  }

  async deletePost(postId, userId) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    if (post.userId.toString() !== userId.toString()) {
      throw new AppError("You are not authorized to delete this post", 403);
    }

    await postDAO.softDeleteById(postId);

    await Promise.all([
      commentDAO.softDeleteMany({ postId, deleted: false }),
      likeDAO.deleteManyByTarget(postId, "post"),
      saveDAO.deleteByPostId(postId),
      notificationDAO.deleteMany({ targetId: postId, targetType: "post" }),
      userDAO.decrementPostsCount(userId),
    ]);
  }

  // ========== LIKE ==========

  async toggleLike(postId, userId) {
    const post = await postDAO.findById(postId);

    if (!post) {
      throw new AppError("Post not found", 404);
    }

    const existingLike = await likeDAO.findOne({ userId, targetId: postId, targetType: "post" });

    if (existingLike) {
      await likeDAO.deleteById(existingLike._id);
      await postDAO.decrementLikesCount(postId);
      // Xóa notification like
      await notificationDAO.deleteOne({ senderId: userId, targetId: postId, type: "like" });

      return { isLiked: false, likesCount: Math.max(0, post.likesCount - 1) };
    } else {
      try {
        await likeDAO.create({ userId, targetId: postId, targetType: "post" });
      } catch (error) {
        if (error.code === 11000) {
          return { isLiked: true, likesCount: post.likesCount };
        }
        throw error;
      }

      await postDAO.incrementLikesCount(postId);

      notificationService.createNotification({
        recipientId: post.userId,
        senderId: userId,
        type: "like",
        targetType: "post",
        targetId: postId,
      }).catch((err) => logger.error("Like notification failed:", err.message));

      return { isLiked: true, likesCount: post.likesCount + 1 };
    }
  }

  // ========== SEARCH / TAGGED ==========

  async searchByHashtag(userId, query = {}) {
    const { q } = query;

    if (!q || q.trim().length === 0) {
      throw new AppError("Search query is required", 400);
    }

    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;

    let searchTag = q.trim().toLowerCase();
    if (!searchTag.startsWith("#")) searchTag = "#" + searchTag;

    const filter = { hashtags: searchTag };
    const populate = { path: "userId", select: "username fullName avatar" };

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(userId, postIds, "post"),
      saveDAO.findByUserAndPosts(userId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      hashtag: searchTag,
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: { page, limit, total, hasMore: skip + posts.length < total },
    };
  }

  async getTaggedPosts(targetUserId, currentUserId, query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || DEFAULT_POST_LIMIT, MAX_POST_LIMIT);
    const skip = (page - 1) * limit;

    const filter = { taggedUsers: targetUserId };
    const populate = [
      { path: "userId", select: "username fullName avatar" },
      { path: "taggedUsers", select: "username fullName avatar" },
    ];

    const [posts, total] = await Promise.all([
      postDAO.findMany(filter, { populate, skip, limit, lean: true }),
      postDAO.count(filter),
    ]);

    const postIds = posts.map((p) => p._id);
    const [likes, saves] = await Promise.all([
      likeDAO.findByUserAndTargets(currentUserId, postIds, "post"),
      saveDAO.findByUserAndPosts(currentUserId, postIds),
    ]);

    const likedSet = new Set(likes.map((l) => l.targetId.toString()));
    const savedSet = new Set(saves.map((s) => s.postId.toString()));

    return {
      posts: formatPostsWithMetadata(posts, likedSet, savedSet),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + posts.length < total,
      },
    };
  }
}

module.exports = new PostService();
