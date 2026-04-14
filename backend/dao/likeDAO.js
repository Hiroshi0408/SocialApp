const Like = require("../models/Like");

class LikeDAO {
  async findOne(userId, targetId, targetType) {
    return await Like.findOne({ userId, targetId, targetType });
  }

  async create(userId, targetId, targetType) {
    const like = new Like({ userId, targetType, targetId });
    return await like.save();
  }

  async deleteOne(userId, targetId, targetType) {
    return await Like.findOneAndDelete({ userId, targetId, targetType });
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
}

module.exports = new LikeDAO();
