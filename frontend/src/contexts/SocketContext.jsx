import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socket) {
        console.log("Disconnecting socket - user not authenticated");
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("No token found for socket authentication");
      return;
    }

    if (socket) {
      console.log(
        "Disconnecting old socket connection before creating new one"
      );
      socket.disconnect();
    }

    console.log(`Creating socket connection for user: ${user.username}`);

    const socketUrl = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
    const newSocket = io(socketUrl, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log(`✓ Socket connected - User: ${user.username} (${user._id})`);
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("✗ Disconnected from Socket.io server");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      setIsConnected(false);
    });

    // Listen for the full list of online users
    newSocket.on("user:online-list", (users) => {
      setOnlineUsers(users);
    });

    newSocket.on("notification:new", ({ notification }) => {
      console.log("New notification received:", notification);
      setUnreadNotifications((prev) => prev + 1);

      if (window.Notification && Notification.permission === "granted") {
        new window.Notification("New Notification", {
          body: `${notification.sender?.username || "Someone"} ${
            notification.type === "like"
              ? "liked your post"
              : notification.type === "comment"
              ? "commented on your post"
              : "started following you"
          }`,
          icon: notification.sender?.avatar || "/default-avatar.png",
        });
      }
    });

    newSocket.on("message:new", () => {
      setUnreadMessages((prev) => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      console.log("Cleaning up socket connection");
      newSocket.off("connect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.off("user:online-list");
      newSocket.off("notification:new");
      newSocket.off("message:new");
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers([]);
    };
  }, [isAuthenticated, user?._id, user?.username]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    unreadNotifications,
    setUnreadNotifications,
    unreadMessages,
    setUnreadMessages,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};