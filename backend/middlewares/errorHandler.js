const AppError = require("../utils/AppError");
const logger = require("../utils/logger.js");
const multer = require("multer");

module.exports = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const isTooLarge = err.code === "LIMIT_FILE_SIZE";
    return res.status(isTooLarge ? 413 : 400).json({
      success: false,
      message: isTooLarge
        ? "File is too large. Please choose a smaller file."
        : err.message,
    });
  }

  if (/^Only .+ allowed$/i.test(err.message || "")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Nếu là AppError (lỗi có thể dự đoán)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
    });
  }

  // Lỗi không mong đợi (bug, crash...)
  logger.error("UNEXPECTED ERROR:", err);
  res.status(500).json({
    success: false,
    message: "Something went wrong",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};
