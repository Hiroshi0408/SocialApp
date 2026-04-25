const express = require("express");
const router = express.Router();
const charityController = require("../controllers/charityController");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  createCampaignValidation,
  recordDonationValidation,
  listCampaignsValidation,
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

module.exports = router;
