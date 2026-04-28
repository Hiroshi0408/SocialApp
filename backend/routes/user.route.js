const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  followLimiter,
  searchLimiter,
} = require("../middlewares/rateLimiter.middleware");
const {
  updateProfileValidation,
  searchUsersValidation,
  userIdValidation,
} = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/suggestions", userController.getSuggestedUsers);
router.get(
  "/search",
  searchLimiter,
  searchUsersValidation,
  userController.searchUsers,
);

router.get("/profile/:username", userController.getUserProfile);
router.put("/profile", updateProfileValidation, userController.updateProfile);

router.get("/:userId/posts", userIdValidation, userController.getUserPosts);
router.post(
  "/:userId/follow",
  followLimiter,
  userIdValidation,
  userController.followUser,
);
router.delete(
  "/:userId/follow",
  followLimiter,
  userIdValidation,
  userController.unfollowUser,
);
router.get(
  "/:userId/follow-status",
  userIdValidation,
  userController.checkFollowStatus,
);
router.get("/:userId/followers", userIdValidation, userController.getFollowers);
router.get("/:userId/following", userIdValidation, userController.getFollowing);

module.exports = router;
