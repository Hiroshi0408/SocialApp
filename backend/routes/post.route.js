const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authMiddleware = require("../middlewares/auth.middleware");
const {
  createPostLimiter,
  commentLimiter,
  likeLimiter,
  searchLimiter,
} = require("../middlewares/rateLimiter.middleware");
const {
  createPostValidation,
  updatePostValidation,
  addCommentValidation,
  mongoIdValidation,
  searchUsersValidation,
} = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/", postController.getAllPosts);
router.get("/feed", postController.getFeed);
router.get("/tagged", postController.getTaggedPosts);
router.get("/tagged/:userId", postController.getTaggedPosts);
router.get(
  "/search/hashtag",
  searchLimiter,
  searchUsersValidation,
  postController.searchByHashtag,
);
router.get("/:id", mongoIdValidation, postController.getPostById);
router.post(
  "/",
  createPostLimiter,
  createPostValidation,
  postController.createPost,
);
router.put("/:id", updatePostValidation, postController.updatePost);
router.delete("/:id", mongoIdValidation, postController.deletePost);

// Interactions
router.post(
  "/:id/like",
  likeLimiter,
  mongoIdValidation,
  postController.toggleLike,
);
router.post(
  "/:id/comments",
  commentLimiter,
  addCommentValidation,
  postController.addComment,
);
router.get("/:id/comments", mongoIdValidation, postController.getComments);

module.exports = router;
