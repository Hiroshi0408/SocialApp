const { uploadImage, uploadVideo, uploadMedia } = require("../config/cloudinary");
const User = require("../models/User");
const logger = require("../utils/logger.js");

//[POST] /api/upload/image - Upload Image
exports.uploadImageToCloudinary = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    logger.info(` Uploading image: ${req.file.originalname} (${req.file.size} bytes)`);

    // Upload to Cloudinary
    const result = await uploadImage(req.file.buffer, "social-app/posts");

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    logger.error(" Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/upload/video - Upload Video
exports.uploadVideoToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No video file provided",
      });
    }

    logger.info(` Uploading video: ${req.file.originalname} (${req.file.size} bytes)`);

    const result = await uploadVideo(req.file.buffer, "social-app/posts/videos");

    res.status(200).json({
      success: true,
      message: "Video uploaded successfully",
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      duration: result.duration,
      format: result.format,
      mediaType: "video",
    });
  } catch (error) {
    logger.error(" Video upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload video",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/upload/media - Upload Media (auto-detect image or video)
exports.uploadMediaToCloudinary = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No media file provided",
      });
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    logger.info(` Uploading ${isVideo ? "video" : "image"}: ${req.file.originalname} (${req.file.size} bytes)`);

    const result = await uploadMedia(req.file.buffer, req.file.mimetype, "social-app/posts");

    const response = {
      success: true,
      message: `${isVideo ? "Video" : "Image"} uploaded successfully`,
      url: result.url,
      publicId: result.publicId,
      width: result.width,
      height: result.height,
      mediaType: isVideo ? "video" : "image",
    };

    if (isVideo) {
      response.duration = result.duration;
      response.format = result.format;
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error(" Media upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload media",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

//[POST] /api/upload/avatar - Upload Avatar and Update User
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    const userId = req.user.id;
    logger.info(`Uploading avatar - User: ${req.user.username}`);

    const result = await uploadImage(req.file.buffer, "social-app/avatars");

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: result.url },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(`Avatar updated - User: ${user.username}`);

    res.status(200).json({
      success: true,
      message: "Avatar uploaded successfully",
      url: result.url,
      publicId: result.publicId,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload avatar",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
