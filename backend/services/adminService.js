const userDAO = require("../dao/userDAO");
const postDAO = require("../dao/postDAO");
const commentDAO = require("../dao/commentDAO");
const likeDAO = require("../dao/likeDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { logAdminAction } = require("../utils/auditLog");

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
      postDAO.count(filter, { includeDeleted: true }),
      postDAO.findMany(filter, {
        skip,
        limit,
        populate: { path: "userId", select: "username fullName avatar" },
        includeDeleted: true,
        lean: true,
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), posts };
  }

  async adminDeletePost(postId, actorInfo) {
    const post = await postDAO.findById(postId, { includeDeleted: true });
    if (!post) throw new AppError("Post not found", 404);

    await postDAO.updateById(postId, { $set: { deleted: true, deletedAt: new Date() } });

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
    const post = await postDAO.findById(postId, { includeDeleted: true });
    if (!post) throw new AppError("Post not found", 404);

    await postDAO.updateById(postId, { $set: { deleted: false }, $unset: { deletedAt: 1 } });

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
      commentDAO.count(filter, { includeDeleted: true }),
      commentDAO.findMany(filter, {
        skip,
        limit,
        populate: { path: "userId", select: "username fullName avatar" },
        select: "_id postId userId content deleted deletedAt createdAt",
        includeDeleted: true,
      }),
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), comments };
  }

  async adminDeleteComment(commentId, actorInfo) {
    const comment = await commentDAO.findById(commentId, { includeDeleted: true });
    if (!comment) throw new AppError("Comment not found", 404);

    await commentDAO.softDeleteById(commentId);

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
    const comment = await commentDAO.findById(commentId, { includeDeleted: true });
    if (!comment) throw new AppError("Comment not found", 404);

    await commentDAO.updateById(commentId, { $set: { deleted: false }, $unset: { deletedAt: 1 } });

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
      userDAO.count({ deleted: { $ne: true } }),
      userDAO.count({ deleted: { $ne: true }, createdAt: { $gte: from7 } }),
      postDAO.count({ deleted: { $ne: true } }),
      commentDAO.count({ deleted: false }),
      likeDAO.countByTargetType("post"),
    ]);

    const [postUsers, commentUsers, likeUsers] = await Promise.all([
      postDAO.distinctUsersByPeriod(from),
      commentDAO.distinctUsersByPeriod(from),
      likeDAO.distinctUsersByPeriod(from),
    ]);

    const activeUsers = new Set([...postUsers, ...commentUsers, ...likeUsers]).size;

    // Top posts by likes
    const topLikeAgg = await likeDAO.topTargets("post", 5);
    const topPostIds = topLikeAgg.map((x) => x._id);
    const posts = await postDAO.findByIds(topPostIds, {
      select: "_id caption image video mediaType createdAt userId",
      populate: { path: "userId", select: "username fullName avatar" },
      lean: true,
    });

    const postMap = new Map(posts.map((p) => [String(p._id), p]));
    const topPosts = await Promise.all(
      topLikeAgg.map(async (x) => {
        const p = postMap.get(String(x._id));
        const commentsCount = await commentDAO.countByPost(x._id);
        return { postId: x._id, likes: x.likes, comments: commentsCount, post: p || null };
      })
    );

    const [usersSeries, postsSeries] = await Promise.all([
      buildDailySeries({ model: userDAO, match: { deleted: { $ne: true } }, days, label: "users" }),
      buildDailySeries({ model: postDAO, match: { deleted: { $ne: true } }, days, label: "posts" }),
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
