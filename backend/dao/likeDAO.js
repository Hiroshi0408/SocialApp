const Like = require("../models/Like");

class LikeDAO {
  async findOne(filter) {
    return await Like.findOne(filter);
  }

  async create(data) {
    const like = new Like(data);
    return await like.save();
  }

  async deleteOne(filter) {
    return await Like.findOneAndDelete(filter);
  }

  async deleteById(id) {
    return await Like.findByIdAndDelete(id);
  }

  // Dùng khi xóa post/comment để dọn likes liên quan
  async deleteManyByTarget(targetId, targetType) {
    return await Like.deleteMany({ targetId, targetType });
  }

  async countByTarget(targetId, targetType) {
    return await Like.countDocuments({ targetId, targetType });
  }

  // Bulk check: user đã like những target nào trong danh sách
  async findByUserAndTargets(userId, targetIds, targetType) {
    return await Like.find({
      userId,
      targetId: { $in: targetIds },
      targetType,
    }).select("targetId");
  }

  // ========== STATS (dùng cho adminService) ==========

  async countByTargetType(targetType) {
    return await Like.countDocuments({ targetType });
  }

  async distinctUsersByPeriod(from) {
    return await Like.distinct("userId", { createdAt: { $gte: from } });
  }

  // Trả về top targets (post/comment) theo số lượt like
  async topTargets(targetType, limit = 5) {
    return await Like.aggregate([
      { $match: { targetType } },
      { $group: { _id: "$targetId", likes: { $sum: 1 } } },
      { $sort: { likes: -1 } },
      { $limit: limit },
    ]);
  }
}

module.exports = new LikeDAO();
