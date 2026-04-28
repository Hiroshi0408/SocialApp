const Follow = require("../models/Follow");

class FollowDAO {
  // ==================== CREATE ====================

  async create(data) {
    const follow = new Follow(data);
    return await follow.save();
  }

  // ==================== DELETE ====================

  async deleteOne(filter) {
    return await Follow.findOneAndDelete(filter).exec();
  }

  // ==================== FIND ====================

  async findOne(filter) {
    return await Follow.findOne(filter).exec();
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
