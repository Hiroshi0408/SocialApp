const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

router.get("/joined", groupController.getJoinedGroups);
router.get("/suggested", groupController.getSuggestedGroups);
router.post("/", groupController.createGroup);
router.post("/:groupId/join", groupController.joinGroup);
router.post("/:groupId/leave", groupController.leaveGroup);

module.exports = router;
