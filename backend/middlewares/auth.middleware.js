const jwt = require("jsonwebtoken");
const User = require("../models/User");
const logger = require("../utils/logger.js");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    let token = req.headers.authorization;

    if (!token || !token.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided. Please login.",
      });
    }

    // Extract token
    token = token.replace("Bearer ", "");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);

    if (!user || user.deleted || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "Invalid token or user not found",
      });
    }

    // Attach user to request
    req.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      status: user.status || "active",
      isEmailVerified: !!user.isEmailVerified,
    };

    next();
  } catch (error) {
    logger.error("Auth middleware error:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    res.status(401).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

module.exports = authMiddleware;
