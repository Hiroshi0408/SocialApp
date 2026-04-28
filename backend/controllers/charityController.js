const charityService = require("../services/charityService");
const logger = require("../utils/logger");

// [GET] /api/charity/campaigns — public list
exports.listCampaigns = async (req, res, next) => {
  try {
    const result = await charityService.listCampaigns(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/charity/campaigns/mine — auth, list theo org của current user
exports.listMyCampaigns = async (req, res, next) => {
  try {
    const result = await charityService.listMyCampaigns(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/charity/campaigns/:id — public detail (?sync=1 để force re-sync chain)
exports.getCampaignDetail = async (req, res, next) => {
  try {
    const forceSync = req.query.sync === "1" || req.query.sync === "true";
    const campaign = await charityService.getCampaignDetail(req.params.id, { forceSync });
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/charity/campaigns/:id/donations — public list donor
exports.listDonations = async (req, res, next) => {
  try {
    const result = await charityService.listDonations(req.params.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/prepare — auth, BE validate + return params cho FE ký tx
exports.prepareCampaign = async (req, res, next) => {
  try {
    logger.info(`Charity prepareCampaign - user=${req.user.username}`);
    const params = await charityService.prepareCampaignCreate(req.user.id, req.body);
    res.json({ success: true, ...params });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/record — auth, FE call sau khi tx createCampaign confirm
exports.recordCampaign = async (req, res, next) => {
  try {
    logger.info(`Charity recordCampaign - user=${req.user.username}, tx=${req.body.txHash}`);
    const campaign = await charityService.recordCampaignCreate(req.user.id, req.body);
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/donations/record — auth, FE call sau khi user ký
exports.recordDonation = async (req, res, next) => {
  try {
    const donation = await charityService.recordDonation(req.user.id, req.body);
    res.status(201).json({ success: true, donation });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/sync — public, force re-sync from chain
exports.syncFromChain = async (req, res, next) => {
  try {
    const result = await charityService.syncFromChain(req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/execute — admin, FUNDED → EXECUTING
exports.markExecuting = async (req, res, next) => {
  try {
    logger.info(`Charity markExecuting - admin=${req.user.username}, campaign=${req.params.id}`);
    const campaign = await charityService.markExecuting(req.params.id, req.user.id);
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/milestones/:idx/unlock — admin, unlock 1 milestone
exports.unlockMilestone = async (req, res, next) => {
  try {
    const { id, idx } = req.params;
    const { reportPostId } = req.body;
    logger.info(`Charity unlockMilestone - admin=${req.user.username}, campaign=${id}, idx=${idx}`);
    const campaign = await charityService.unlockMilestone(id, idx, reportPostId, req.user.id);
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/admin/force-fail/:id — admin, force campaign → FAILED
exports.adminForceFail = async (req, res, next) => {
  try {
    logger.info(`Charity adminForceFail - admin=${req.user.username}, campaign=${req.params.id}`);
    const campaign = await charityService.adminForceFail(req.params.id, req.user.id);
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/mark-failed — public, trigger OPEN → FAILED sau deadline
exports.markFailedIfExpired = async (req, res, next) => {
  try {
    const campaign = await charityService.markFailedIfExpired(req.params.id);
    res.json({ success: true, campaign });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/campaigns/:id/donations/record-refund — auth, FE call sau claimRefund tx
exports.recordRefund = async (req, res, next) => {
  try {
    const donation = await charityService.recordRefund(req.user.id, req.body);
    res.json({ success: true, donation });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/charity/admin/whitelist-org — admin, whitelist org wallet on-chain
exports.whitelistOrg = async (req, res, next) => {
  try {
    const { orgId } = req.body;
    logger.info(`Charity whitelistOrg - admin=${req.user.username}, org=${orgId}`);
    await charityService.whitelistOrgOnChain(orgId);
    res.json({ success: true, message: "Organization whitelisted on-chain" });
  } catch (error) {
    next(error);
  }
};
