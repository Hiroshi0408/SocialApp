const userDAO = require("../dao/userDAO");
const followDAO = require("../dao/followDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const friendService = require("./friendService");
const notificationService = require("./notificationService");
const postService = require("./postService");

const {
  DEFAULT_POST_LIMIT,
  DEFAULT_USER_LIMIT,
  MAX_USER_LIMIT,
  DEFAULT_SUGGESTED_USERS_LIMIT,
} = require("../constants");

class UserService {
  // ==================== PROFILE ====================

  async getUserProfile(username, currentUserId) {
    const user = await userDAO.findOne({
      username,
      deleted: false,
      status: "active",
    });

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const [followDoc, friendship] = await Promise.all([
      followDAO.findOne(currentUserId, user._id),
      friendService.resolveFriendshipStatus(currentUserId, user._id),
    ]);

    return {
      user: {
        ...user.toJSON(),
        isFollowing: !!followDoc,
        friendship,
        isOwnProfile: user._id.toString() === currentUserId,
      },
    };
  }

  async updateProfile(userId, { fullName, bio, website }) {
    const updates = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (bio !== undefined) updates.bio = bio;
    if (website !== undefined) updates.website = website;

    let user;
    try {
      user = await userDAO.updateById(userId, updates, { runValidators: true });
    } catch (err) {
      if (err.name === "ValidationError") {
        const errors = {};
        Object.keys(err.errors).forEach((k) => {
          errors[k] = err.errors[k].message;
        });
        throw new AppError("Validation failed", 400, errors);
      }
      throw err;
    }

    if (!user) {
      throw new AppError("User not found", 404);
    }

    logger.info("Profile updated:", user.username);

    return { message: "Profile updated successfully", user: user.toJSON() };
  }

  async uploadAvatar(userId, avatarUrl) {
    if (!avatarUrl) {
      throw new AppError("Avatar URL is required", 400);
    }

    const user = await userDAO.updateById(userId, { avatar: avatarUrl });

    logger.info("Avatar updated:", user.username);

    return {
      message: "Avatar updated successfully",
      avatarUrl: user.avatar,
      user: user.toJSON(),
    };
  }

  // ==================== POSTS ====================

  async getUserPosts(userId, currentUserId, query = {}) {
    return await postService.getUserPosts(userId, currentUserId, query);
  }

  // ==================== FOLLOW ====================

  /**
   * Follow logic:
   * 1. followDAO.create()  → ghi vào collection follows
   * 2. userDAO.incrementFollowCounters()  → cập nhật counter trên cả 2 user
   * 3. createNotification()  → gửi notification
   *
   * Lý do tách follow.save() khỏi counter update:
   * Nếu dùng Promise.all(follow.save, counter), khi counter fail thì
   * follow đã được ghi nhưng counter sai. Tách ra giúp ta biết chính xác
   * bước nào fail và log cụ thể hơn. (Giải pháp triệt để là MongoDB transactions)
   */
  async followUser(currentUserId, targetUserId) {
    if (targetUserId === currentUserId) {
      throw new AppError("Cannot follow yourself", 400);
    }

    const targetUser = await userDAO.findById(targetUserId);
    if (!targetUser) {
      throw new AppError("User not found", 404);
    }

    const existing = await followDAO.findOne(currentUserId, targetUserId);
    if (existing) {
      throw new AppError("Already following this user", 400);
    }

    try {
      await followDAO.create(currentUserId, targetUserId);
    } catch (err) {
      // Bẫy race condition: 2 request follow cùng lúc
      if (err.code === 11000) {
        throw new AppError("Already following this user", 400);
      }
      throw err;
    }

    await userDAO.incrementFollowCounters(currentUserId, targetUserId);

    // Notification fail không block response
    try {
      await notificationService.createNotification({
        recipientId: targetUserId,
        senderId: currentUserId,
        type: "follow",
        targetType: "user",
        targetId: currentUserId,
      });
    } catch (err) {
      logger.error("Follow notification failed:", err.message);
    }

    return { message: "User followed successfully" };
  }

  async unfollowUser(currentUserId, targetUserId) {
    const follow = await followDAO.deleteOne(currentUserId, targetUserId);

    if (!follow) {
      throw new AppError("Not following this user", 404);
    }

    // decrementFollowCounters dùng $max nên counter không bao giờ âm
    await userDAO.decrementFollowCounters(currentUserId, targetUserId);

    return { message: "User unfollowed successfully" };
  }

  async checkFollowStatus(currentUserId, targetUserId) {
    const follow = await followDAO.findOne(currentUserId, targetUserId);
    return { isFollowing: !!follow };
  }

  // ==================== FOLLOWERS / FOLLOWING ====================

  async getFollowers(userId, { page = 1, limit = DEFAULT_USER_LIMIT }) {
    limit = Math.min(Number(limit), MAX_USER_LIMIT);
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      followDAO.findFollowers(userId, { skip, limit }),
      followDAO.countFollowers(userId),
    ]);

    const users = followers.map((f) => f.follower);

    return {
      users,
      pagination: { page, limit, total, hasMore: skip + users.length < total },
    };
  }

  async getFollowing(userId, { page = 1, limit = DEFAULT_USER_LIMIT }) {
    limit = Math.min(Number(limit), MAX_USER_LIMIT);
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      followDAO.findFollowing(userId, { skip, limit }),
      followDAO.countFollowing(userId),
    ]);

    const users = following.map((f) => f.following);

    return {
      users,
      pagination: { page, limit, total, hasMore: skip + users.length < total },
    };
  }

  // ==================== SEARCH / SUGGESTIONS ====================

  async getSuggestedUsers(currentUserId, limit = DEFAULT_SUGGESTED_USERS_LIMIT) {
    limit = Math.min(Number(limit), MAX_USER_LIMIT);

    const followingIds = await followDAO.findFollowingIds(currentUserId);

    const suggestedUsers = await userDAO.findMany(
      {
        _id: { $nin: [...followingIds, currentUserId] },
        deleted: false,
        status: "active",
      },
      {
        select: "username fullName avatar followersCount",
        sort: { followersCount: -1 },
        limit,
        lean: true,
      }
    );

    const users = suggestedUsers.map((user) => ({
      ...user,
      isFollowing: false,
      subtitle: `${user.followersCount} followers`,
    }));

    return { users };
  }

  async searchUsers(query, { page = 1, limit = DEFAULT_USER_LIMIT }) {
    if (!query || query.trim().length === 0) {
      throw new AppError("Search query is required", 400);
    }

    limit = Math.min(Number(limit), MAX_USER_LIMIT);
    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(query.trim(), "i");

    const filter = {
      $or: [{ username: searchRegex }, { fullName: searchRegex }],
      deleted: false,
      status: "active",
    };

    const [users, total] = await Promise.all([
      userDAO.findMany(filter, {
        select: "username fullName avatar followersCount",
        sort: { followersCount: -1 },
        limit,
        skip,
        lean: true,
      }),
      userDAO.count(filter),
    ]);

    return {
      users,
      pagination: { page, limit, total, hasMore: skip + users.length < total },
    };
  }
}

module.exports = new UserService();
