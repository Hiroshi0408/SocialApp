const express = require("express");
const router = express.Router();
const multer = require("multer");
const uploadController = require("../controllers/uploadController");
const authMiddleware = require("../middlewares/auth.middleware");
const { uploadLimiter } = require("../middlewares/rateLimiter.middleware");

// Configure Multer for memory storage
const storage = multer.memoryStorage();

// Image upload config
const imageUpload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"), false);
    }
  },
});

// Video upload config
const videoUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP4, WebM, MOV, and AVI videos are allowed"), false);
    }
  },
});

// Media upload config (both image and video)
const mediaUpload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for video, images will be smaller
  },
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

    if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only images (JPEG, PNG, GIF, WebP) and videos (MP4, WebM, MOV, AVI) are allowed"), false);
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

// Upload image for posts
router.post(
  "/image",
  uploadLimiter,
  imageUpload.single("image"),
  uploadController.uploadImageToCloudinary
);

// Upload video for posts
router.post(
  "/video",
  uploadLimiter,
  videoUpload.single("video"),
  uploadController.uploadVideoToCloudinary
);

// Upload media (auto-detect image or video)
router.post(
  "/media",
  uploadLimiter,
  mediaUpload.single("media"),
  uploadController.uploadMediaToCloudinary
);

// Upload avatar
router.post(
  "/avatar",
  uploadLimiter,
  imageUpload.single("image"),
  uploadController.uploadAvatar
);

module.exports = router;
