const AppError = require("../utils/AppError");
const logger = require("../utils/logger.js");

module.exports = (err, req, res, next) => {
  // Nếu là AppError (lỗi có thể dự đoán)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
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
