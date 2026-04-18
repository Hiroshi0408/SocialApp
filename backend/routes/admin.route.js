const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const adminController = require("../controllers/adminController");

// All admin endpoints require auth + role
router.use(authMiddleware);
router.use(requireRole("admin", "mod"));

// User management
router.get("/users", adminController.listUsers);
router.patch(
  "/users/:id/ban",
  requireRole("admin", "mod"),
  adminController.banUser,
);
router.patch(
  "/users/:id/unban",
  requireRole("admin", "mod"),
  adminController.unbanUser,
);
router.patch(
  "/users/:id/role",
  requireRole("admin"),
  adminController.setUserRole,
);

// Moderation (soft delete / restore)
router.get("/moderation/posts", adminController.listPosts);
router.patch(
  "/moderation/posts/:id/delete",
  requireRole("admin", "mod"),
  adminController.adminDeletePost,
);
router.patch(
  "/moderation/posts/:id/restore",
  requireRole("admin", "mod"),
  adminController.restorePost,
);

router.get("/moderation/comments", adminController.listComments);
router.patch(
  "/moderation/comments/:id/delete",
  requireRole("admin", "mod"),
  adminController.adminDeleteComment,
);
router.patch(
  "/moderation/comments/:id/restore",
  requireRole("admin", "mod"),
  adminController.restoreComment,
);

// Stats & audit
router.get("/stats", adminController.getStats);
router.get("/audit", requireRole("admin"), adminController.listAuditLogs);

// Organizations (charity verify)
router.get("/organizations", adminController.listOrganizations);
router.patch(
  "/organizations/:id/verify",
  requireRole("admin"),
  adminController.verifyOrganization,
);
router.patch(
  "/organizations/:id/reject",
  requireRole("admin"),
  adminController.rejectOrganization,
);

module.exports = router;
