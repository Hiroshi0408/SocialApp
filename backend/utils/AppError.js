class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // lỗi có thể dự đoán (khác với bug)
  }
}

module.exports = AppError;
