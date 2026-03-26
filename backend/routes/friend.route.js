const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friendController");
const authMiddleware = require("../middlewares/auth.middleware");
const { followLimiter } = require("../middlewares/rateLimiter.middleware");
const { userIdValidation } = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/", friendController.getFriends);
router.get("/requests/incoming", friendController.getIncomingFriendRequests);
router.get("/requests/outgoing", friendController.getOutgoingFriendRequests);

router.post(
  "/requests/:userId",
  followLimiter,
  userIdValidation,
  friendController.sendFriendRequest,
);

router.delete(
  "/requests/:userId",
  followLimiter,
  userIdValidation,
  friendController.cancelFriendRequest,
);

router.post(
  "/requests/:userId/accept",
  followLimiter,
  userIdValidation,
  friendController.acceptFriendRequest,
);

router.post(
  "/requests/:userId/reject",
  followLimiter,
  userIdValidation,
  friendController.rejectFriendRequest,
);

router.get(
  "/:userId/status",
  userIdValidation,
  friendController.getFriendshipStatus,
);

router.delete(
  "/:userId",
  followLimiter,
  userIdValidation,
  friendController.unfriendUser,
);

module.exports = router;
