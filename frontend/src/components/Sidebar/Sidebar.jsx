import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CreatePostModal from "../CreatePostModal/CreatePostModal";
import { useSocket } from "../../contexts/SocketContext";
import { getUserAvatar, showInfo } from "../../utils";
import "./Sidebar.css";

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { unreadNotifications, unreadMessages } = useSocket();

  const isActive = (path) => location.pathname === path;

  const handlePostCreated = (newPost) => {
    setShowCreateModal(false);
    if (location.pathname === "/home" || location.pathname === "/profile") {
      navigate(0);
    } else {
      navigate("/home");
    }
  };

  const menuItems = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z" />
        </svg>
      ),
      label: t("sidebar.home"),
      path: "/home",
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M12 8v8m-4-4h8" />
        </svg>
      ),
      label: t("sidebar.create"),
      path: "/create",
      onClick: () => setShowCreateModal(true),
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="22,7 13.03,12.7 2,7" />
        </svg>
      ),
      label: t("sidebar.messages"),
      path: "/messages",
      badge: unreadMessages > 0 ? unreadMessages : null,
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      label: t("sidebar.notifications"),
      path: "/notifications",
      badge: unreadNotifications > 0 ? unreadNotifications : null,
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      ),
      label: t("sidebar.explore"),
      path: "/search",
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      label: t("sidebar.profile"),
      path: "/profile",
    },
    {
      icon: (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3z" />
          <path d="M8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z" />
          <path d="M2 20c0-2.21 3.58-4 8-4s8 1.79 8 4" />
        </svg>
      ),
      label: t("sidebar.groups"),
      path: "/groups",
      badge: 4,
    },
  ];

  const handleNavigation = (item) => {
    if (item.onClick) {
      item.onClick();
    } else {
      navigate(item.path);
    }
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-container">
          {/* Logo */}
          <div className="sidebar-logo" onClick={() => navigate("/home")}>
            <h1>SocialApp</h1>
          </div>

          {/* Menu Items */}
          <nav className="sidebar-nav">
            {menuItems.map((item, index) => (
              <button
                key={index}
                className={`sidebar-item ${
                  isActive(item.path) ? "active" : ""
                }`}
                onClick={() => handleNavigation(item)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.label}</span>
                {item.badge && (
                  <span className="sidebar-badge">{item.badge}</span>
                )}
              </button>
            ))}
          </nav>

          {/* User Profile at bottom */}
          <div className="sidebar-footer">
            <button
              className="sidebar-user"
              onClick={() => navigate("/profile")}
            >
              <img
                src={getUserAvatar(user)}
                alt={user.username}
                className="sidebar-user-avatar"
              />
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {user.fullName || user.username}
                </span>
                <span className="sidebar-user-username">@{user.username}</span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={handlePostCreated}
      />
    </>
  );
}

export default Sidebar;
