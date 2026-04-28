const adminService = require("../services/adminService");
const organizationService = require("../services/organizationService");
const logger = require("../utils/logger");

const actorInfo = (req) => ({
  id: req.user.id,
  username: req.user.username,
  ip: req.ip,
  userAgent: req.headers["user-agent"],
});

// [GET] /api/admin/users
exports.listUsers = async (req, res, next) => {
  try {
    const result = await adminService.listUsers(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/users/:id/ban
exports.banUser = async (req, res, next) => {
  try {
    const user = await adminService.banUser(req.params.id, actorInfo(req));
    res.json({ success: true, message: "User banned", user });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/users/:id/unban
exports.unbanUser = async (req, res, next) => {
  try {
    const user = await adminService.unbanUser(req.params.id, actorInfo(req));
    res.json({ success: true, message: "User unbanned", user });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/users/:id/role
exports.setUserRole = async (req, res, next) => {
  try {
    const role = String(req.body.role || "").toLowerCase();
    const user = await adminService.setUserRole(req.params.id, role, actorInfo(req));
    res.json({ success: true, message: "Role updated", user });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/admin/moderation/posts
exports.listPosts = async (req, res, next) => {
  try {
    const result = await adminService.listPosts(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/moderation/posts/:id/delete
exports.adminDeletePost = async (req, res, next) => {
  try {
    await adminService.adminDeletePost(req.params.id, actorInfo(req));
    res.json({ success: true, message: "Post soft-deleted" });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/moderation/posts/:id/restore
exports.restorePost = async (req, res, next) => {
  try {
    await adminService.restorePost(req.params.id, actorInfo(req));
    res.json({ success: true, message: "Post restored" });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/admin/moderation/comments
exports.listComments = async (req, res, next) => {
  try {
    const result = await adminService.listComments(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/moderation/comments/:id/delete
exports.adminDeleteComment = async (req, res, next) => {
  try {
    await adminService.adminDeleteComment(req.params.id, actorInfo(req));
    res.json({ success: true, message: "Comment soft-deleted" });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/moderation/comments/:id/restore
exports.restoreComment = async (req, res, next) => {
  try {
    await adminService.restoreComment(req.params.id, actorInfo(req));
    res.json({ success: true, message: "Comment restored" });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/admin/stats
exports.getStats = async (req, res, next) => {
  try {
    const result = await adminService.getStats(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/admin/audit
exports.listAuditLogs = async (req, res, next) => {
  try {
    const logs = await adminService.listAuditLogs(req.query);
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

// ==================== ORGANIZATIONS ====================

// [GET] /api/admin/organizations?status=pending
exports.listOrganizations = async (req, res, next) => {
  try {
    const result = await organizationService.adminList(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/organizations/:id/verify
exports.verifyOrganization = async (req, res, next) => {
  try {
    logger.info(`Admin verify org - admin=${req.user.username}, org=${req.params.id}`);
    const organization = await organizationService.verify(req.user.id, req.params.id);
    res.json({ success: true, message: "Organization verified", organization });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/admin/organizations/:id/reject
exports.rejectOrganization = async (req, res, next) => {
  try {
    const reason = req.body?.reason || "";
    const organization = await organizationService.reject(req.user.id, req.params.id, reason);
    res.json({ success: true, message: "Organization rejected", organization });
  } catch (error) {
    next(error);
  }
};
