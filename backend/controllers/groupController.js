const groupService = require("../services/groupService");
const logger = require("../utils/logger");

// [GET] /api/groups/joined
exports.getJoinedGroups = async (req, res, next) => {
  try {
    const groups = await groupService.getJoinedGroups(req.user.id);
    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/groups/suggested
exports.getSuggestedGroups = async (req, res, next) => {
  try {
    const groups = await groupService.getSuggestedGroups(req.user.id, req.query);
    res.json({ success: true, groups });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/groups/:groupId
exports.getGroupById = async (req, res, next) => {
  try {
    const group = await groupService.getGroupById(
      req.user.id,
      req.params.groupId,
    );
    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/groups
exports.createGroup = async (req, res, next) => {
  try {
    logger.info(`Create group - User: ${req.user.username}`);
    const group = await groupService.createGroup(req.user.id, req.body);
    res.status(201).json({ success: true, group });
  } catch (error) {
    next(error);
  }
};

// [PATCH] /api/groups/:groupId
exports.updateGroup = async (req, res, next) => {
  try {
    const group = await groupService.updateGroup(
      req.user.id,
      req.params.groupId,
      req.body,
    );
    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/groups/:groupId
exports.deleteGroup = async (req, res, next) => {
  try {
    const result = await groupService.deleteGroup(
      req.user.id,
      req.params.groupId,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/groups/:groupId/join
exports.joinGroup = async (req, res, next) => {
  try {
    const result = await groupService.joinGroup(req.user.id, req.params.groupId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/groups/:groupId/leave
exports.leaveGroup = async (req, res, next) => {
  try {
    const result = await groupService.leaveGroup(req.user.id, req.params.groupId);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/groups/:groupId/members/:userId
exports.kickMember = async (req, res, next) => {
  try {
    const result = await groupService.kickMember(
      req.user.id,
      req.params.groupId,
      req.params.userId,
    );
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/groups/:groupId/transfer-ownership
exports.transferOwnership = async (req, res, next) => {
  try {
    const group = await groupService.transferOwnership(
      req.user.id,
      req.params.groupId,
      req.body.targetUserId,
    );
    res.json({ success: true, group });
  } catch (error) {
    next(error);
  }
};
