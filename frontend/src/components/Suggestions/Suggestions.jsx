import React, { useState, useEffect, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import userService from "../../api/userService";
import { normalizeArrayResponse, getId, getUserAvatar } from "../../utils";
import { showError } from "../../utils/toast";
import { useAvatarError } from "../../hooks/useAvatarError";
import { useNavigate } from "react-router-dom";
import "./Suggestions.css";

function Suggestions() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const { handleAvatarError, getAvatarSrc } = useAvatarError();
  const navigate = useNavigate();

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.getSuggestedUsers();
      const normalizedUsers = normalizeArrayResponse(data, "users");
      setUsers(normalizedUsers);

      const statuses = {};
      await Promise.all(
        normalizedUsers.map(async (user) => {
          const userId = getId(user);
          if (!userId || userId === currentUser?._id) {
            statuses[userId] = "self";
            return;
          }

          try {
            const statusRes = await userService.getFriendshipStatus(userId);
            statuses[userId] = statusRes.status || "none";
          } catch {
            statuses[userId] = "none";
          }
        }),
      );

      setFriendshipStatuses(statuses);
    } catch (error) {
      showError(t("suggestions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t, currentUser?._id]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const getFriendActionLabel = (status) => {
    if (status === "friends") return t("friends.actions.friends");
    if (status === "outgoing_request") return t("friends.actions.sentShort");
    if (status === "incoming_request") return t("friends.actions.accept");
    return t("friends.actions.add");
  };

  const handleFriendAction = useCallback(
    async (userId) => {
      try {
        const status = friendshipStatuses[userId] || "none";

        if (status === "friends") {
          await userService.unfriendUser(userId);
          setFriendshipStatuses((prev) => ({ ...prev, [userId]: "none" }));
        } else if (status === "outgoing_request") {
          await userService.cancelFriendRequest(userId);
          setFriendshipStatuses((prev) => ({ ...prev, [userId]: "none" }));
        } else if (status === "incoming_request") {
          await userService.acceptFriendRequest(userId);
          setFriendshipStatuses((prev) => ({ ...prev, [userId]: "friends" }));
        } else {
          await userService.sendFriendRequest(userId);
          setFriendshipStatuses((prev) => ({
            ...prev,
            [userId]: "outgoing_request",
          }));
        }
      } catch (error) {
        showError(t("suggestions.followError"));
      }
    },
    [t, friendshipStatuses],
  );

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
  };
  return (
    <div className="suggestions-container">
      {/* Current User Profile */}
      {currentUser && (
        <div className="current-user">
          <img
            src={getAvatarSrc(currentUser, getUserAvatar)}
            alt={currentUser.username}
            className="current-user-avatar"
            onError={() => handleAvatarError(currentUser._id)}
          />
          <div className="current-user-info">
            <span className="current-user-username">
              {currentUser.username}
            </span>
            <span className="current-user-name">{currentUser.fullName}</span>
          </div>
        </div>
      )}

      {/* Suggestions Header */}
      <div className="suggestions-header">
        <span className="suggestions-title">{t("suggestions.title")}</span>
        <button className="see-all-btn">{t("suggestions.seeAll")}</button>
      </div>

      {/* Suggestions List */}
      <div className="suggestions-list">
        {loading ? (
          <p className="centered-text">{t("suggestions.loading")}</p>
        ) : users.length === 0 ? (
          <p className="centered-text">{t("suggestions.noSuggestions")}</p>
        ) : (
          users.map((user) => (
            <div key={getId(user)} className="suggestion-item">
              <img
                src={getAvatarSrc(user, getUserAvatar)}
                alt={user.username}
                className="suggestion-avatar"
                onError={() => handleAvatarError(user._id)}
              />
              <div
                className="suggestion-info"
                onClick={() => handleUserClick(user.username)}
              >
                <span className="suggestion-username">{user.username}</span>
                <span className="suggestion-subtitle">{user.subtitle}</span>
              </div>
              {friendshipStatuses[getId(user)] !== "self" && (
                <button
                  className={`follow-btn ${
                    friendshipStatuses[getId(user)] === "friends" ||
                    friendshipStatuses[getId(user)] === "outgoing_request"
                      ? "following"
                      : ""
                  }`}
                  onClick={() => handleFriendAction(getId(user))}
                >
                  {getFriendActionLabel(friendshipStatuses[getId(user)])}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Links */}
      <footer className="suggestions-footer">
        <div className="footer-links">
          <a href="#">{t("suggestions.about")}</a>
          <a href="#">{t("suggestions.help")}</a>
          <a href="#">{t("suggestions.press")}</a>
          <a href="#">{t("suggestions.api")}</a>
          <a href="#">{t("suggestions.jobs")}</a>
          <a href="#">{t("suggestions.privacy")}</a>
          <a href="#">{t("suggestions.terms")}</a>
        </div>
        <p className="footer-copyright">{t("suggestions.copyright")}</p>
      </footer>
    </div>
  );
}

export default memo(Suggestions);
