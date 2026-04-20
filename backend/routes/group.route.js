const express = require("express");
const router = express.Router();
const groupController = require("../controllers/groupController");
const authMiddleware = require("../middlewares/auth.middleware");

router.use(authMiddleware);

// List
router.get("/joined", groupController.getJoinedGroups);
router.get("/suggested", groupController.getSuggestedGroups);

// CRUD
router.post("/", groupController.createGroup);
router.get("/:groupId", groupController.getGroupById);
router.patch("/:groupId", groupController.updateGroup);
router.delete("/:groupId", groupController.deleteGroup);

// Membership
router.post("/:groupId/join", groupController.joinGroup);
router.post("/:groupId/leave", groupController.leaveGroup);
router.delete("/:groupId/members/:userId", groupController.kickMember);
router.post("/:groupId/transfer-ownership", groupController.transferOwnership);

module.exports = router;
