const mongoose = require("mongoose");
const Comment = require("../models/Comment");

class CommentDAO {
  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false, includeDeleted = false } = options;
    const filter = includeDeleted ? { _id: id } : { _id: id, deleted: false };
    let query = Comment.findOne(filter);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query;
  }

  async findByPost(postId, options = {}) {
    const { skip = 0, limit = 20 } = options;
    return await Comment.find({ postId, deleted: false, parentCommentId: null })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async findReplies(parentCommentId) {
    return await Comment.find({ parentCommentId, deleted: false })
      .populate("userId", "username fullName avatar")
      .sort({ createdAt: 1 }) // Oldest first cho replies
      .lean();
  }

  // $graphLookup để tìm toàn bộ cây con đệ quy
  async findDescendants(commentId) {
    const result = await Comment.aggregate([
      {
        $graphLookup: {
          from: "comments",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parentCommentId",
          as: "descendants",
          restrictSearchWithMatch: { deleted: false },
        },
      },
      { $match: { _id: new mongoose.Types.ObjectId(commentId) } },
    ]);
    return result[0]?.descendants || [];
  }

  async create(data) {
    const comment = new Comment(data);
    return await comment.save();
  }

  async updateById(id, data) {
    return await Comment.findByIdAndUpdate(id, data, { new: true });
  }

  async softDeleteById(id) {
    return await Comment.findByIdAndUpdate(
      id,
      { $set: { deleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }

  async softDeleteMany(filter) {
    return await Comment.updateMany(filter, { $set: { deleted: true, deletedAt: new Date() } });
  }

  async findMany(filter, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, select = "", populate = "", lean = true, includeDeleted = false } = options;
    const baseFilter = includeDeleted ? filter : { ...filter, deleted: false };
    let query = Comment.find(baseFilter).sort(sort).skip(skip).limit(limit);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query;
  }

  async count(filter, options = {}) {
    const { includeDeleted = false } = options;
    const baseFilter = includeDeleted ? filter : { ...filter, deleted: false };
    return await Comment.countDocuments(baseFilter);
  }

  async incrementLikesCount(id) {
    return await Comment.findByIdAndUpdate(id, { $inc: { likesCount: 1 } }, { new: true });
  }

  async decrementLikesCount(id) {
    return await Comment.findByIdAndUpdate(
      id,
      [{ $set: { likesCount: { $max: [0, { $subtract: ["$likesCount", 1] }] } } }],
      { new: true }
    );
  }

  async incrementRepliesCount(id) {
    return await Comment.findByIdAndUpdate(id, { $inc: { repliesCount: 1 } }, { new: true });
  }

  async decrementRepliesCount(id) {
    return await Comment.findByIdAndUpdate(
      id,
      [{ $set: { repliesCount: { $max: [0, { $subtract: ["$repliesCount", 1] }] } } }],
      { new: true }
    );
  }

  // ========== STATS (dùng cho adminService) ==========

  async distinctUsersByPeriod(from) {
    return await Comment.distinct("userId", { createdAt: { $gte: from } });
  }

  async countByPost(postId) {
    return await Comment.countDocuments({ postId, deleted: false });
  }
}

module.exports = new CommentDAO();
