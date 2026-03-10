const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const { logAdminAction } = require("../utils/auditLog");

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

const buildDailySeries = async ({
  model,
  dateField = "createdAt",
  match = {},
  days = 7,
  label = "count",
}) => {
  const from = startOfDay(daysAgo(days - 1));

  const results = await model.aggregate([
    { $match: { ...match, [dateField]: { $gte: from } } },
    {
      $group: {
        _id: {
          y: { $year: `$${dateField}` },
          m: { $month: `$${dateField}` },
          d: { $dayOfMonth: `$${dateField}` },
        },
        c: { $sum: 1 },
      },
    },
    { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
  ]);

  const map = new Map(
    results.map((r) => {
      const dt = new Date(r._id.y, r._id.m - 1, r._id.d);
      const key = dt.toISOString().slice(0, 10);
      return [key, r.c];
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

// [GET] /api/admin/users
exports.listUsers = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = req.query.status; // active | banned | pending | ...
    const role = req.query.role; // user | mod | admin
    const verified = req.query.verified; // true | false
    const q = (req.query.q || "").trim();

    const filter = { deleted: { $ne: true } };

    if (status && status !== "all") filter.status = status;
    if (role && role !== "all") filter.role = role;
    if (verified === "true") filter.isEmailVerified = true;
    if (verified === "false") filter.isEmailVerified = false;

    if (q) {
      filter.$or = [
        { username: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { fullName: { $regex: q, $options: "i" } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          "_id username fullName email role status isEmailVerified createdAt lastLoginAt updatedAt"
        )
        .lean(),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      users,
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/users/:id/ban
exports.banUser = async (req, res) => {
  try {
    const targetId = req.params.id;

    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: { status: "suspended", bannedAt: new Date() } },
      { new: true, runValidators: true }
    ).select("_id username email status role");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "BAN_USER",
      targetType: "user",
      targetId,
      details: { status: "banned" },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "User banned", user });
  } catch (error) {
    console.error("Admin ban user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to ban user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/users/:id/unban
exports.unbanUser = async (req, res) => {
  try {
    const targetId = req.params.id;

    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: { status: "active" }, $unset: { bannedAt: 1 } },
      { new: true }
    ).select("_id username email status role");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "UNBAN_USER",
      targetType: "user",
      targetId,
      details: { status: "active" },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "User unbanned", user });
  } catch (error) {
    console.error("Admin unban user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unban user",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/users/:id/role
exports.setUserRole = async (req, res) => {
  try {
    const targetId = req.params.id;
    const role = String(req.body.role || "").toLowerCase();

    if (!["user", "mod", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      targetId,
      { $set: { role } },
      { new: true }
    ).select("_id username email status role");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "SET_ROLE",
      targetType: "user",
      targetId,
      details: { role },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Role updated", user });
  } catch (error) {
    console.error("Admin set role error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set role",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/admin/moderation/posts
exports.listPosts = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = req.query.status || "active"; // active|deleted|all
    const q = (req.query.q || "").trim();

    const filter = {};
    if (status === "active") filter.deleted = false;
    if (status === "deleted") filter.deleted = true;

    if (q) {
      filter.$or = [
        { caption: { $regex: q, $options: "i" } },
        { location: { $regex: q, $options: "i" } },
      ];
    }

    const [total, posts] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "username fullName avatar")
        .select(
          "_id userId caption mediaType image video location deleted deletedAt createdAt"
        )
        .lean(),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      posts,
    });
  } catch (error) {
    console.error("Admin list posts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list posts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/moderation/posts/:id/delete
exports.adminDeletePost = async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    post.deleted = true;
    post.deletedAt = new Date();
    await post.save();

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "DELETE_POST",
      targetType: "post",
      targetId: postId,
      details: { deleted: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Post soft-deleted" });
  } catch (error) {
    console.error("Admin delete post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/moderation/posts/:id/restore
exports.restorePost = async (req, res) => {
  try {
    const postId = req.params.id;

    const post = await Post.findById(postId);
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });

    post.deleted = false;
    post.deletedAt = undefined;
    await post.save();

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "RESTORE_POST",
      targetType: "post",
      targetId: postId,
      details: { deleted: false },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Post restored" });
  } catch (error) {
    console.error("Admin restore post error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore post",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/admin/moderation/comments
exports.listComments = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(5, toInt(req.query.limit, 20)));
    const skip = (page - 1) * limit;

    const status = req.query.status || "active";
    const q = (req.query.q || "").trim();

    const filter = {};
    if (status === "active") filter.deleted = false;
    if (status === "deleted") filter.deleted = true;

    if (q) {
      filter.$or = [{ content: { $regex: q, $options: "i" } }];
    }

    const [total, comments] = await Promise.all([
      Comment.countDocuments(filter),
      Comment.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "username fullName avatar")
        .select("_id postId userId content deleted deletedAt createdAt")
        .lean(),
    ]);

    res.json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      comments,
    });
  } catch (error) {
    console.error("Admin list comments error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list comments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/moderation/comments/:id/delete
exports.adminDeleteComment = async (req, res) => {
  try {
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });

    comment.deleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "DELETE_COMMENT",
      targetType: "comment",
      targetId: commentId,
      details: { deleted: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Comment soft-deleted" });
  } catch (error) {
    console.error("Admin delete comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [PATCH] /api/admin/moderation/comments/:id/restore
exports.restoreComment = async (req, res) => {
  try {
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });

    comment.deleted = false;
    comment.deletedAt = undefined;
    await comment.save();

    await logAdminAction({
      actorId: req.user.id,
      actorUsername: req.user.username,
      action: "RESTORE_COMMENT",
      targetType: "comment",
      targetId: commentId,
      details: { deleted: false },
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ success: true, message: "Comment restored" });
  } catch (error) {
    console.error("Admin restore comment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore comment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/admin/stats?days=7|30
exports.getStats = async (req, res) => {
  try {
    const days = req.query.days === "30" ? 30 : 7;
    const from = startOfDay(daysAgo(days - 1));
    const from7 = startOfDay(daysAgo(6));

    const [totalUsers, newUsers7, totalPosts, totalComments, totalLikes] =
      await Promise.all([
        User.countDocuments({ deleted: { $ne: true } }),
        User.countDocuments({
          deleted: { $ne: true },
          createdAt: { $gte: from7 },
        }),
        Post.countDocuments({ deleted: { $ne: true } }),
        Comment.countDocuments({ deleted: { $ne: true } }),
        Like.countDocuments({ targetType: "post" }),
      ]);

    // DAU/WAU (approx): users who posted/commented/liked within range
    const [postUsers, commentUsers, likeUsers] = await Promise.all([
      Post.distinct("userId", { createdAt: { $gte: from } }),
      Comment.distinct("userId", { createdAt: { $gte: from } }),
      Like.distinct("userId", { createdAt: { $gte: from } }),
    ]);
    const activeUsers = new Set([...postUsers, ...commentUsers, ...likeUsers])
      .size;

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
        const commentsCount = await Comment.countDocuments({
          postId: x._id,
          deleted: false,
        });
        return {
          postId: x._id,
          likes: x.likes,
          comments: commentsCount,
          post: p || null,
        };
      })
    );

    const usersSeries = await buildDailySeries({
      model: User,
      match: { deleted: { $ne: true } },
      days,
      label: "users",
    });

    const postsSeries = await buildDailySeries({
      model: Post,
      match: { deleted: { $ne: true } },
      days,
      label: "posts",
    });

    res.json({
      success: true,
      summary: {
        totalUsers,
        newUsers7,
        totalPosts,
        totalComments,
        totalLikes,
        activeUsers,
      },
      series: {
        users: usersSeries,
        posts: postsSeries,
      },
      topPosts,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get stats",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/admin/audit?limit=50
exports.listAuditLogs = async (req, res) => {
  try {
    let AuditLog;
    try {
      AuditLog = require("../models/AuditLog");
    } catch (err) {
      return res.json({ success: true, logs: [] });
    }

    const limit = Math.min(200, Math.max(10, toInt(req.query.limit, 50)));
    const logs = await AuditLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, logs });
  } catch (error) {
    console.error("Admin audit list error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list audit logs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
