const express = require("express");
const router = express.Router();
const storyController = require("../controllers/storyController");
const authMiddleware = require("../middlewares/auth.middleware");
const { createPostLimiter } = require("../middlewares/rateLimiter.middleware");
const {
  userIdValidation,
  storyIdValidation,
} = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/", storyController.getAllStories);
router.post("/", createPostLimiter, storyController.createStory);
router.get("/user/:userId", userIdValidation, storyController.getUserStories);
router.post("/:storyId/view", storyIdValidation, storyController.viewStory);
router.get(
  "/:storyId/viewers",
  storyIdValidation,
  storyController.getStoryViewers,
);
router.delete("/:storyId", storyIdValidation, storyController.deleteStory);

module.exports = router;
