const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const setupChatHandlers = require("../socket/chatHandlers");
const setupCallHandlers = require("../socket/callHandlers");

let io;
// Map to store online users: { userId -> socketId }
const onlineUsers = new Map();

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Socket authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  // Connection event
  io.on("connection", (socket) => {
    console.log(`✓ User connected: ${socket.username} (${socket.userId})`);

    // Add user to online list and broadcast the new list
    onlineUsers.set(socket.userId, socket.id);
    io.emit("user:online-list", Array.from(onlineUsers.keys()));

    // Join user to their personal room for private notifications
    socket.join(`user:${socket.userId}`);

    // Set up event handlers
    setupChatHandlers(io, socket);
    setupCallHandlers(io, socket);

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log(`✗ User disconnected: ${socket.username} (${socket.userId})`);
      onlineUsers.delete(socket.userId);
      // Broadcast the updated list
      io.emit("user:online-list", Array.from(onlineUsers.keys()));
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  console.log("✓ Socket.io initialized successfully");
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initializeSocket, getIO };