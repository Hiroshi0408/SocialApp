const friendService = require("../services/friendService");
const logger = require("../utils/logger");

// [POST] /api/friends/requests/:userId
exports.sendFriendRequest = async (req, res, next) => {
  try {
    logger.info(`Send friend request - From: ${req.user.id}, To: ${req.params.userId}`);
    await friendService.sendRequest(req.user.id, req.params.userId);
    res.json({ success: true, message: "Friend request sent" });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/friends/requests/:userId
exports.cancelFriendRequest = async (req, res, next) => {
  try {
    await friendService.cancelRequest(req.user.id, req.params.userId);
    res.json({ success: true, message: "Friend request canceled" });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/friends/requests/:userId/accept
exports.acceptFriendRequest = async (req, res, next) => {
  try {
    await friendService.acceptRequest(req.params.userId, req.user.id);
    res.json({ success: true, message: "Friend request accepted" });
  } catch (error) {
    next(error);
  }
};

// [POST] /api/friends/requests/:userId/reject
exports.rejectFriendRequest = async (req, res, next) => {
  try {
    await friendService.rejectRequest(req.params.userId, req.user.id);
    res.json({ success: true, message: "Friend request rejected" });
  } catch (error) {
    next(error);
  }
};

// [DELETE] /api/friends/:userId
exports.unfriendUser = async (req, res, next) => {
  try {
    await friendService.unfriend(req.user.id, req.params.userId);
    res.json({ success: true, message: "Friend removed successfully" });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/friends
exports.getFriends = async (req, res, next) => {
  try {
    const result = await friendService.getFriends(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/friends/requests/incoming
exports.getIncomingFriendRequests = async (req, res, next) => {
  try {
    const result = await friendService.getIncomingRequests(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/friends/requests/outgoing
exports.getOutgoingFriendRequests = async (req, res, next) => {
  try {
    const result = await friendService.getOutgoingRequests(req.user.id, req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// [GET] /api/friends/:userId/status
exports.getFriendshipStatus = async (req, res, next) => {
  try {
    const status = await friendService.getFriendshipStatus(req.user.id, req.params.userId);
    res.json({ success: true, ...status });
  } catch (error) {
    next(error);
  }
};
