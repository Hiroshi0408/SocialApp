const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDatabase = require("./config/database");
const { apiLimiter } = require("./middlewares/rateLimiter.middleware");
const { initializeSocket } = require("./config/socket");
const errorHandler = require("./middlewares/errorHandler");
const logger = require("./utils/logger.js");
// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  "MONGODB_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error(" Missing required environment variables:");
  missingEnvVars.forEach((envVar) => logger.error(`   - ${envVar}`));
  process.exit(1);
}

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// MIDDLEWARES
// CORS - Allow frontend to connect
// CORS và Security Headers
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - Apply to all API routes
app.use("/api/", apiLimiter);

// Request logging (development only)
if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
}

// DATABASE CONNECTION
connectDatabase();

// INITIALIZE SOCKET.IO
initializeSocket(server);

// ROUTES
app.use("/api/auth", require("./routes/auth.route"));
app.use("/api/users", require("./routes/user.route"));
app.use("/api/posts", require("./routes/post.route"));
app.use("/api/comments", require("./routes/comment.route"));
app.use("/api/upload", require("./routes/upload.route"));
app.use("/api/saves", require("./routes/save.route"));
app.use("/api/notifications", require("./routes/notification.route"));
app.use("/api/chat", require("./routes/chat.route"));
app.use("/api/stories", require("./routes/story.route"));
app.use("/api/admin", require("./routes/admin.route"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ERROR HANDLER
app.use(errorHandler);
// START SERVER
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info("\n================================");
  logger.info(` Server running on port ${PORT}`);
  logger.info(` Environment: ${process.env.NODE_ENV}`);
  logger.info(` API URL: http://localhost:${PORT}/api`);
  logger.info(` Socket.io: Enabled`);
  logger.info(" ================================\n");
});
