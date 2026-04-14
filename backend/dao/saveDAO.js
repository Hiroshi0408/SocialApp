const mongoose = require("mongoose");
const Save = require("../models/Save");

class SaveDAO {
  async findOne(userId, postId) {
    return await Save.findOne({ userId, postId });
  }

  async create(userId, postId) {
    const save = new Save({ userId, postId });
    return await save.save();
  }

  async deleteOne(userId, postId) {
    return await Save.findOneAndDelete({ userId, postId });
  }

  // Bulk check: user đã save những post nào trong danh sách
  async findByUserAndPosts(userId, postIds) {
    return await Save.find({ userId, postId: { $in: postIds } }).select("postId");
  }

  async deleteByPostId(postId) {
    return await Save.deleteMany({ postId });
  }

  // Trả về posts (joined + filtered deleted) kèm pagination
  async findByUser(userId, options = {}) {
    const { skip = 0, limit = 20 } = options;

    return await Save.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "postId",
        match: { deleted: false },
        populate: { path: "userId", select: "username fullName avatar" },
      })
      .lean();
  }

  async countByUser(userId) {
    const result = await Save.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $lookup: { from: "posts", localField: "postId", foreignField: "_id", as: "post" } },
      { $unwind: "$post" },
      { $match: { "post.deleted": false } },
      { $count: "total" },
    ]);
    return result.length > 0 ? result[0].total : 0;
  }
}

module.exports = new SaveDAO();
