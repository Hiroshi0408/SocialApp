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

// [POST] /api/charity/campaigns — auth, org owner verified
exports.createCampaign = async (req, res, next) => {
  try {
    logger.info(`Charity createCampaign - user=${req.user.username}`);
    const campaign = await charityService.createCampaign(req.user.id, req.body);
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
