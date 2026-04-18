const organizationService = require("../services/organizationService");
const logger = require("../utils/logger");

// [GET] /api/organizations  — public list (chỉ verified)
exports.listOrganizations = async (req, res, next) => {
  try {
    const result = await organizationService.list(req.query, {
      isAdmin: req.user?.role === "admin" || req.user?.role === "mod",
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/organizations/mine  — org của current user (nếu có)
exports.getMine = async (req, res, next) => {
  try {
    const organization = await organizationService.getMine(req.user.id);
    res.json({ success: true, organization });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/organizations/:slug  — public detail
exports.getBySlug = async (req, res, next) => {
  try {
    const viewer = req.user
      ? {
          userId: req.user.id,
          isAdmin: req.user.role === "admin" || req.user.role === "mod",
        }
      : {};
    const organization = await organizationService.getBySlug(req.params.slug, viewer);
    res.json({ success: true, organization });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/organizations  — apply
exports.apply = async (req, res, next) => {
  try {
    logger.info(`Organization apply - User: ${req.user.username}`);
    const organization = await organizationService.apply(req.user.id, req.body);
    res.status(201).json({ success: true, organization });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/organizations/:id  — owner update
exports.update = async (req, res, next) => {
  try {
    const organization = await organizationService.update(
      req.user.id,
      req.params.id,
      req.body
    );
    res.json({ success: true, organization });
  } catch (error) {
    next(error);
  }
};
