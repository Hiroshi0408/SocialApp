const logger = require("../utils/logger.js");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Upload image to Cloudinary
const uploadImage = async (fileBuffer, folder = "social-app") => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: "auto",
          transformation: [
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            logger.info("Image uploaded to Cloudinary:", result.secure_url);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    logger.error("Upload failed:", error);
    throw error;
  }
};

// Upload video to Cloudinary
const uploadVideo = async (fileBuffer, folder = "social-app/videos") => {
  try {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: "video",
          chunk_size: 6000000,
          eager: [
            { format: "mp4", transformation: [{ quality: "auto" }] },
          ],
          eager_async: true,
        },
        (error, result) => {
          if (error) {
            logger.error("Cloudinary video upload error:", error);
            reject(error);
          } else {
            logger.info("Video uploaded to Cloudinary:", result.secure_url);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              width: result.width,
              height: result.height,
              duration: result.duration,
              format: result.format,
            });
          }
        }
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    logger.error("Video upload failed:", error);
    throw error;
  }
};

// Upload media (auto-detect type)
const uploadMedia = async (fileBuffer, mimetype, folder = "social-app") => {
  if (mimetype.startsWith("video/")) {
    return uploadVideo(fileBuffer, `${folder}/videos`);
  }
  return uploadImage(fileBuffer, `${folder}/images`);
};

// Delete image from Cloudinary
const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info("Image deleted from Cloudinary:", publicId);
    return result;
  } catch (error) {
    logger.error("Delete failed:", error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  uploadMedia,
  deleteImage,
};
