const mongoose = require("mongoose");
const Comment = require("../models/Comment");

class CommentDAO {
  async findById(id) {
    return await Comment.findOne({ _id: id, deleted: false });
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

  async count(filter) {
    return await Comment.countDocuments({ ...filter, deleted: false });
  }

  // Dùng cho admin — không bị force deleted: false
  async adminCount(filter) {
    return await Comment.countDocuments(filter);
  }

  async adminFindMany(filter, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, select = "", populate = "" } = options;
    let query = Comment.find(filter).sort(sort).skip(skip).limit(limit);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    return await query.lean();
  }

  async adminFindById(id) {
    return await Comment.findById(id);
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
}

module.exports = new CommentDAO();
