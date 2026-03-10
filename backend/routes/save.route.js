const express = require("express");
const router = express.Router();
const saveController = require("../controllers/saveController");
const authMiddleware = require("../middlewares/auth.middleware");
const { postIdValidation } = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/", saveController.getSavedPosts);
router.post("/:postId", postIdValidation, saveController.savePost);
router.delete("/:postId", postIdValidation, saveController.unsavePost);
router.get("/:postId/status", postIdValidation, saveController.checkSaveStatus);

module.exports = router;
