const express = require("express");
const router = express.Router();
const charityController = require("../controllers/charityController");
const authMiddleware = require("../middlewares/auth.middleware");
const { requireRole } = require("../middlewares/role.middleware");
const {
  createCampaignValidation,
  recordDonationValidation,
  listCampaignsValidation,
  unlockMilestoneValidation,
  whitelistOrgValidation,
  mongoIdValidation,
} = require("../middlewares/validation.middleware");

// ════════════ Public ════════════
router.get("/campaigns", listCampaignsValidation, charityController.listCampaigns);

// /mine phải đứng trước /:id để không bị Express bắt nhầm "mine" thành mongoId
router.get("/campaigns/mine", authMiddleware, charityController.listMyCampaigns);

router.get("/campaigns/:id", mongoIdValidation, charityController.getCampaignDetail);
router.get(
  "/campaigns/:id/donations",
  mongoIdValidation,
  charityController.listDonations
);
router.post("/campaigns/:id/sync", mongoIdValidation, charityController.syncFromChain);

// ════════════ Auth (org owner) ════════════
router.post(
  "/campaigns",
  authMiddleware,
  createCampaignValidation,
  charityController.createCampaign
);

router.post(
  "/campaigns/:id/donations/record",
  authMiddleware,
  recordDonationValidation,
  charityController.recordDonation
);

// ════════════ Admin ════════════
router.post(
  "/campaigns/:id/execute",
  authMiddleware,
  requireRole("admin"),
  mongoIdValidation,
  charityController.markExecuting
);

router.post(
  "/campaigns/:id/milestones/:idx/unlock",
  authMiddleware,
  requireRole("admin"),
  unlockMilestoneValidation,
  charityController.unlockMilestone
);

router.post(
  "/admin/force-fail/:id",
  authMiddleware,
  requireRole("admin"),
  mongoIdValidation,
  charityController.adminForceFail
);

router.post(
  "/admin/whitelist-org",
  authMiddleware,
  requireRole("admin"),
  whitelistOrgValidation,
  charityController.whitelistOrg
);

module.exports = router;
