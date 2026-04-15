const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/auth.middleware");
const { mongoIdValidation } = require("../middlewares/validation.middleware");

router.use(authMiddleware);

router.get("/", notificationController.getNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.put("/read-all", notificationController.markAllAsRead);
router.put("/:id/read", mongoIdValidation, notificationController.markAsRead);
router.delete(
  "/:id",
  mongoIdValidation,
  notificationController.deleteNotification,
);

module.exports = router;
