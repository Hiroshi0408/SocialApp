class AppError extends Error {
  /**
   * @param {string} message   - Thông báo lỗi chính
   * @param {number} statusCode - HTTP status code
   * @param {object} [errors]  - Field-level errors (tuỳ chọn), VD: { username: "taken", email: null }
   */
  constructor(message, statusCode, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // lỗi có thể dự đoán (khác với bug)
    if (errors) this.errors = errors;
  }
}

module.exports = AppError;
