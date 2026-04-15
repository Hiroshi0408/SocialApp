const Post = require("../models/Post");

class PostDAO {
  async findById(id, options = {}) {
    const { populate = "", lean = false, includeDeleted = false } = options;
    const filter = includeDeleted ? { _id: id } : { _id: id, deleted: false };
    let query = Post.findOne(filter);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findMany(filter, options = {}) {
    const {
      populate = "",
      sort = { createdAt: -1 },
      skip = 0,
      limit = 20,
      lean = false,
      includeDeleted = false,
    } = options;

    const baseFilter = includeDeleted ? filter : { ...filter, deleted: false };
    let query = Post.find(baseFilter).sort(sort).skip(skip).limit(limit);

    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async create(data) {
    const post = new Post(data);
    return await post.save();
  }

  async updateById(id, data) {
    return await Post.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async softDeleteById(id) {
    return await Post.findByIdAndUpdate(
      id,
      { deleted: true, deletedAt: new Date() },
      { new: true }
    ).exec();
  }

  async count(filter, options = {}) {
    const { includeDeleted = false } = options;
    const baseFilter = includeDeleted ? filter : { ...filter, deleted: false };
    return await Post.countDocuments(baseFilter);
  }

  async incrementLikesCount(postId) {
    return await Post.findByIdAndUpdate(
      postId,
      { $inc: { likesCount: 1 } },
      { new: true }
    ).exec();
  }

  async decrementLikesCount(postId) {
    return await Post.findByIdAndUpdate(
      postId,
      [{ $set: { likesCount: { $max: [0, { $subtract: ["$likesCount", 1] }] } } }],
      { new: true }
    ).exec();
  }

  async incrementCommentsCount(postId) {
    return await Post.findByIdAndUpdate(
      postId,
      { $inc: { commentsCount: 1 } },
      { new: true }
    ).exec();
  }

  async decrementCommentsCount(postId, amount = 1) {
    return await Post.findByIdAndUpdate(
      postId,
      [{ $set: { commentsCount: { $max: [0, { $subtract: ["$commentsCount", amount] }] } } }],
      { new: true }
    ).exec();
  }

  async incrementSavesCount(postId) {
    return await Post.findByIdAndUpdate(
      postId,
      { $inc: { savesCount: 1 } },
      { new: true }
    ).exec();
  }

  async decrementSavesCount(postId) {
    return await Post.findByIdAndUpdate(
      postId,
      [{ $set: { savesCount: { $max: [0, { $subtract: ["$savesCount", 1] }] } } }],
      { new: true }
    ).exec();
  }

  // ========== STATS (dùng cho adminService) ==========

  async aggregate(pipeline) {
    return await Post.aggregate(pipeline);
  }

  async distinctUsersByPeriod(from) {
    return await Post.distinct("userId", { createdAt: { $gte: from } });
  }

  async findByIds(ids, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Post.find({ _id: { $in: ids } });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }
}

module.exports = new PostDAO();
