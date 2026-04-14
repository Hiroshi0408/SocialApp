const userDAO = require("../dao/userDAO");
const postDAO = require("../dao/postDAO");
const commentDAO = require("../dao/commentDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { logAdminAction } = require("../utils/auditLog");

// TODO: Thay bằng likeDAO aggregation khi có
const Like = require("../models/Like");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");

// ====== Helpers nội bộ ======

const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const buildDailySeries = async ({ model, dateField = "createdAt", match = {}, days = 7, label = "count" }) => {
  const from = startOfDay(daysAgo(days - 1));

  const results = await model.aggregate([
    { $match: { ...match, [dateField]: { $gte: from } } },
    {
      $group: {
        _id: { y: { $year: `$${dateField}` }, m: { $month: `$${dateField}` }, d: { $dayOfMonth: `$${dateField}` } },
        c: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
  ]);

  const map = new Map(
    results.map((r) => {
      const dt = new Date(r._id.y, r._id.m - 1, r._id.d);
      return [dt.toISOString().slice(0, 10), r.c];
    })
  );

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = startOfDay(daysAgo(i));
    const key = dt.toISOString().slice(0, 10);
    series.push({ date: key, [label]: map.get(key) || 0 });
  }
  return series;
};

// ====== Service methods ======

class AdminService {
  // ========== USERS ==========

  async listUsers(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;

    const filter = { deleted: { $ne: true } };

    if (query.status && query.status !== "all") filter.status = query.status;
    if (query.role && query.role !== "all") filter.role = query.role;
    if (query.verified === "true") filter.isEmailVerified = true;
    if (query.verified === "false") filter.isEmailVerified = false;

    const q = (query.q || "").trim();
    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { fullName: { $regex: q, $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      userDAO.count(filter),
      userDAO.findMany(filter, {
        sort: { createdAt: -1 },
        skip,
        limit,
        select: "_id username fullName email role status isEmailVerified createdAt lastLoginAt updatedAt",
        lean: true,
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), users };
  }

  async banUser(targetId, actorInfo) {
    const user = await userDAO.updateById(
      targetId,
      { $set: { status: "suspended", bannedAt: new Date() } },
      { runValidators: true }
    );

    if (!user) throw new AppError("User not found", 404);

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "BAN_USER",
      targetType: "user",
      targetId,
      details: { status: "banned" },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });

    return user;
  }

  async unbanUser(targetId, actorInfo) {
    const user = await userDAO.updateById(targetId, { $set: { status: "active" }, $unset: { bannedAt: 1 } });

    if (!user) throw new AppError("User not found", 404);

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "UNBAN_USER",
      targetType: "user",
      targetId,
      details: { status: "active" },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });

    return user;
  }

  async setUserRole(targetId, role, actorInfo) {
    if (!["user", "mod", "admin"].includes(role)) {
      throw new AppError("Invalid role", 400);
    }

    const user = await userDAO.updateById(targetId, { $set: { role } });
    if (!user) throw new AppError("User not found", 404);

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "SET_ROLE",
      targetType: "user",
      targetId,
      details: { role },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });

    return user;
  }

  // ========== POSTS ==========

  async listPosts(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = query.status || "active";
    const filter = {};
    if (status === "active") filter.deleted = false;
    if (status === "deleted") filter.deleted = true;

    const q = (query.q || "").trim();
    if (q) {
      filter.$or = [
        { caption: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const [total, posts] = await Promise.all([
      postDAO.adminCount(filter),
      postDAO.adminFindMany(filter, {
        skip,
        limit,
        populate: { path: "userId", select: "username fullName avatar" },
        select: "_id userId caption mediaType image video location deleted deletedAt createdAt",
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), posts };
  }

  async adminDeletePost(postId, actorInfo) {
    const post = await postDAO.adminFindById(postId);
    if (!post) throw new AppError("Post not found", 404);

    post.deleted = true;
    post.deletedAt = new Date();
    await post.save();

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "DELETE_POST",
      targetType: "post",
      targetId: postId,
      details: { deleted: true },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });
  }

  async restorePost(postId, actorInfo) {
    const post = await postDAO.adminFindById(postId);
    if (!post) throw new AppError("Post not found", 404);

    post.deleted = false;
    post.deletedAt = undefined;
    await post.save();

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "RESTORE_POST",
      targetType: "post",
      targetId: postId,
      details: { deleted: false },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });
  }

  // ========== COMMENTS ==========

  async listComments(query = {}) {
    const page = Math.max(1, toInt(query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = query.status || "active";
    const filter = {};
    if (status === "active") filter.deleted = false;
    if (status === "deleted") filter.deleted = true;

    const q = (query.q || "").trim();
    if (q) filter.$or = [{ content: { $regex: q, $options: "i" } }];

    const [total, comments] = await Promise.all([
      commentDAO.adminCount(filter),
      commentDAO.adminFindMany(filter, {
        skip,
        limit,
        populate: { path: "userId", select: "username fullName avatar" },
        select: "_id postId userId content deleted deletedAt createdAt",
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), comments };
  }

  async adminDeleteComment(commentId, actorInfo) {
    const comment = await commentDAO.adminFindById(commentId);
    if (!comment) throw new AppError("Comment not found", 404);

    comment.deleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "DELETE_COMMENT",
      targetType: "comment",
      targetId: commentId,
      details: { deleted: true },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });
  }

  async restoreComment(commentId, actorInfo) {
    const comment = await commentDAO.adminFindById(commentId);
    if (!comment) throw new AppError("Comment not found", 404);

    comment.deleted = false;
    comment.deletedAt = undefined;
    await comment.save();

    await logAdminAction({
      actorId: actorInfo.id,
      actorUsername: actorInfo.username,
      action: "RESTORE_COMMENT",
      targetType: "comment",
      targetId: commentId,
      details: { deleted: false },
      ip: actorInfo.ip,
      userAgent: actorInfo.userAgent,
    });
  }

  // ========== STATS ==========

  async getStats(query = {}) {
    const days = query.days === "30" ? 30 : 7;
    const from = startOfDay(daysAgo(days - 1));
    const from7 = startOfDay(daysAgo(6));

    const [totalUsers, newUsers7, totalPosts, totalComments, totalLikes] = await Promise.all([
      User.countDocuments({ deleted: { $ne: true } }),
      User.countDocuments({ deleted: { $ne: true }, createdAt: { $gte: from7 } }),
      Post.countDocuments({ deleted: { $ne: true } }),
      Comment.countDocuments({ deleted: { $ne: true } }),
      Like.countDocuments({ targetType: "post" }),
    ]);

    const [postUsers, commentUsers, likeUsers] = await Promise.all([
      Post.distinct("userId", { createdAt: { $gte: from } }),
      Comment.distinct("userId", { createdAt: { $gte: from } }),
      Like.distinct("userId", { createdAt: { $gte: from } }),
    ]);

    const activeUsers = new Set([...postUsers, ...commentUsers, ...likeUsers]).size;

    // Top posts by likes
    const topLikeAgg = await Like.aggregate([
      { $match: { targetType: "post" } },
      { $group: { _id: "$targetId", likes: { $sum: 1 } } },
      { $sort: { likes: -1 } },
      { $limit: 5 },
    ]);

    const topPostIds = topLikeAgg.map((x) => x._id);
    const posts = await Post.find({ _id: { $in: topPostIds } })
      .select("_id caption image video mediaType createdAt userId")
      .populate("userId", "username fullName avatar")
      .lean();

    const postMap = new Map(posts.map((p) => [String(p._id), p]));
    const topPosts = await Promise.all(
      topLikeAgg.map(async (x) => {
        const p = postMap.get(String(x._id));
        const commentsCount = await Comment.countDocuments({ postId: x._id, deleted: false });
        return { postId: x._id, likes: x.likes, comments: commentsCount, post: p || null };
      })
    );

    const [usersSeries, postsSeries] = await Promise.all([
      buildDailySeries({ model: User, match: { deleted: { $ne: true } }, days, label: "users" }),
      buildDailySeries({ model: Post, match: { deleted: { $ne: true } }, days, label: "posts" }),
    ]);

    return {
      summary: { totalUsers, newUsers7, totalPosts, totalComments, totalLikes, activeUsers },
      series: { users: usersSeries, posts: postsSeries },
      topPosts,
    };
  }

  async listAuditLogs(query = {}) {
    let AuditLog;
    try {
      AuditLog = require("../models/AuditLog");
    } catch (err) {
      return [];
    }

    const limit = Math.min(200, Math.max(10, toInt(query.limit, 50)));
    return await AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
}

module.exports = new AdminService();
