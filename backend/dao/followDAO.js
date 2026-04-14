const Follow = require("../models/Follow");

class FollowDAO {
  // ==================== CREATE ====================

  async create(followerId, followingId) {
    const follow = new Follow({ follower: followerId, following: followingId });
    return await follow.save();
  }

  // ==================== DELETE ====================

  async deleteOne(followerId, followingId) {
    return await Follow.findOneAndDelete({
      follower: followerId,
      following: followingId,
    }).exec();
  }

  // ==================== FIND ====================

  async findOne(followerId, followingId) {
    return await Follow.findOne({
      follower: followerId,
      following: followingId,
    }).exec();
  }

  async findFollowers(userId, options = {}) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 } } = options;

    return await Follow.find({ following: userId })
      .populate("follower", "username fullName avatar followersCount")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  async findFollowing(userId, options = {}) {
    const { skip = 0, limit = 20, sort = { createdAt: -1 } } = options;

    return await Follow.find({ follower: userId })
      .populate("following", "username fullName avatar followersCount")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  }

  // ==================== COUNT ====================

  async countFollowers(userId) {
    return await Follow.countDocuments({ following: userId });
  }

  async countFollowing(userId) {
    return await Follow.countDocuments({ follower: userId });
  }

  // ==================== HELPERS ====================

  /**
   * Trả về mảng ObjectId của tất cả người mà userId đang follow.
   * Dùng để loại trừ khỏi suggested users.
   */
  async findFollowingIds(userId) {
    const follows = await Follow.find({ follower: userId })
      .select("following")
      .lean()
      .exec();
    return follows.map((f) => f.following);
  }
}

module.exports = new FollowDAO();
