const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const authMiddleware = require("../middlewares/auth.middleware");

// Public routes (guest xem được verified orgs)
router.get("/", organizationController.listOrganizations);

// Auth required
router.get("/mine", authMiddleware, organizationController.getMine);
router.post("/", authMiddleware, organizationController.apply);
router.patch("/:id", authMiddleware, organizationController.update);

// Public detail — phải để cuối để không bắt nhầm /mine
router.get("/:slug", organizationController.getBySlug);

module.exports = router;
