import React, { useState, useEffect, useCallback, useMemo, memo } from "react";
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
  const [loading, setLoading] = useState(true);
  const { handleAvatarError, getAvatarSrc } = useAvatarError();
  const navigate = useNavigate();

  const currentUserAvatar = useMemo(
    () => getUserAvatar(currentUser),
    [currentUser],
  );

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.getSuggestedUsers();
      setUsers(normalizeArrayResponse(data, "users"));
    } catch (error) {
      showError(t("suggestions.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleFollow = useCallback(
    async (userId) => {
      try {
        await userService.followUser(userId);
        setUsers((prev) =>
          prev.map((user) =>
            getId(user) === userId
              ? { ...user, isFollowing: !user.isFollowing }
              : user,
          ),
        );
      } catch (error) {
        showError(t("suggestions.followError"));
      }
    },
    [t],
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
              <button
                className={`follow-btn ${user.isFollowing ? "following" : ""}`}
                onClick={() => handleFollow(getId(user))}
              >
                {user.isFollowing
                  ? t("suggestions.following")
                  : t("suggestions.follow")}
              </button>
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
