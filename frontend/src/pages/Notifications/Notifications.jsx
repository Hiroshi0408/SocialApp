import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import Loading from "../../components/Loading/Loading";
import { useSocket } from "../../contexts/SocketContext";
import { notificationService } from "../../api";
import { getUserAvatar, formatTimestamp } from "../../utils";
import { showError } from "../../utils/toast";
import "./Notifications.css";

const getReferenceId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value.$oid) return value.$oid;
  if (value._id || value.id) return getReferenceId(value._id || value.id);

  const stringValue = value.toString?.();
  return stringValue && stringValue !== "[object Object]" ? stringValue : null;
};

const getNotificationPostId = (notification) => {
  if (notification.targetType === "comment") {
    return (
      getReferenceId(notification.postId) ||
      getReferenceId(notification.targetId?.postId)
    );
  }

  return getReferenceId(notification.targetId);
};

const getNotificationDestination = (notification) => {
  switch (notification.type) {
    case "like":
    case "comment":
    case "mention":
    case "auto_post": {
      const postId = getNotificationPostId(notification);
      return postId ? `/post/${postId}` : null;
    }
    case "follow":
    case "friend_request":
    case "friend_accept":
      return notification.sender?.username
        ? `/profile/${notification.sender.username}`
        : null;
    default:
      return null;
  }
};

function Notifications() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { socket, setUnreadNotifications } = useSocket();
  const navigate = useNavigate();

  const handleNewNotification = useCallback((data) => {
    const { notification } = data;
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on("notification:new", handleNewNotification);

      return () => {
        socket.off("notification:new", handleNewNotification);
      };
    }
  }, [socket, handleNewNotification]);

  const markAllReadLocally = useCallback(() => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
    if (setUnreadNotifications) {
      setUnreadNotifications(0);
    }
  }, [setUnreadNotifications]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await notificationService.getAllNotifications();
      if (response.success) {
        const nextNotifications = response.notifications || [];
        setNotifications(nextNotifications);

        if (nextNotifications.some((notif) => !notif.read)) {
          await notificationService.markAllAsRead();
          setNotifications(
            nextNotifications.map((notif) => ({ ...notif, read: true })),
          );
        }

        if (setUnreadNotifications) {
          setUnreadNotifications(0);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || t("notificationsPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [setUnreadNotifications, t]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === notificationId ? { ...notif, read: true } : notif,
        ),
      );
      if (setUnreadNotifications) {
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      showError(t("notificationsPage.markAsReadError"));
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      markAllReadLocally();
    } catch (err) {
      showError(t("notificationsPage.markAllAsReadError"));
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications(
        notifications.filter((notif) => notif._id !== notificationId),
      );
    } catch (err) {
      showError(t("notificationsPage.deleteError"));
    }
  };

  const getNotificationMessage = (notification) => {
    const sender =
      notification.sender?.username || t("notificationsPage.someone");
    switch (notification.type) {
      case "like":
        if (notification.targetType === "comment") {
          return `${sender} ${t("notificationsPage.likedYourComment")}`;
        }
        return `${sender} ${t("notificationsPage.likedYourPost")}`;
      case "comment":
        return `${sender} ${t("notificationsPage.commented", {
          text: notification.text,
        })}`;
      case "follow":
        return `${sender} ${t("notificationsPage.startedFollowingYou")}`;
      case "mention":
        return `${sender} ${t("notificationsPage.mentionedYou", {
          text: notification.text,
        })}`;
      case "friend_request":
        return `${sender} ${t("notificationsPage.sentFriendRequest")}`;
      case "friend_accept":
        return `${sender} ${t("notificationsPage.acceptedFriendRequest")}`;
      case "auto_post":
        // Hệ thống tạo post thay org owner — text đã được BE build sẵn theo loại
        // event (kickoff/funded/milestone). Không prefix sender vì recipient = sender.
        return notification.text || t("notificationsPage.autoPostCreated");
      default:
        return `${sender} ${t("notificationsPage.interactedWithYourContent")}`;
    }
  };

  const handleNotificationClick = async (notification) => {
    const destination = getNotificationDestination(notification);

    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }

    if (destination) {
      navigate(destination);
    } else {
      showError(t("notificationsPage.openTargetError"));
    }
  };

  if (loading) {
    return (
      <div className="notifications-page">
        <Sidebar />
        <div className="notifications-content-wrapper">
          <Header />
          <main className="notifications-main">
            <Loading />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-page">
      <Sidebar />
      <div className="notifications-content-wrapper">
        <Header />
        <main className="notifications-main">
          <div className="notifications-container">
            <div className="notifications-header">
              <h2>{t("notificationsPage.title")}</h2>
              {notifications.some((n) => !n.read) && (
                <button onClick={handleMarkAllAsRead} className="mark-all-btn">
                  {t("notificationsPage.markAllAsReadButton")}
                </button>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {notifications.length === 0 ? (
              <div className="empty-state">
                <p>{t("notificationsPage.noNotifications")}</p>
                <span>{t("notificationsPage.emptyStateDescription")}</span>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`notification-item ${
                      notification.read ? "" : "unread"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                    style={{ cursor: "pointer" }}
                  >
                    <img
                      src={getUserAvatar(notification.sender)}
                      alt={
                        notification.sender?.username ||
                        t("notificationsPage.usernameAlt")
                      }
                    />
                    <div className="notification-content">
                      <p>{getNotificationMessage(notification)}</p>
                      <span>
                        {formatTimestamp(
                          notification.createdAt || notification.timestamp,
                        )}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(notification._id);
                      }}
                      className="delete-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Notifications;
