const Post = require("../models/Post");

class PostDAO {
  async findById(id, options = {}) {
    const { populate = "", lean = false } = options;
    let query = Post.findOne({ _id: id, deleted: false });
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
    } = options;

    let query = Post.find({ ...filter, deleted: false })
      .sort(sort)
      .skip(skip)
      .limit(limit);

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

  async count(filter) {
    return await Post.countDocuments({ ...filter, deleted: false });
  }

  // Dùng cho admin — không bị force deleted: false
  async adminCount(filter) {
    return await Post.countDocuments(filter);
  }

  async adminFindMany(filter, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, select = "", populate = "" } = options;
    let query = Post.find(filter).sort(sort).skip(skip).limit(limit);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    return await query.lean();
  }

  async adminFindById(id) {
    return await Post.findById(id);
  }

  async adminUpdateById(id, data) {
    return await Post.findByIdAndUpdate(id, data, { new: true });
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
}

module.exports = new PostDAO();
