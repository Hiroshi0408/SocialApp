import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { userService } from "../../api";
import { getUserAvatar, showError } from "../../utils";
import "./FollowListModal.css";

function FollowListModal({ type, userId, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [type, userId]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response =
        type === "followers"
          ? await userService.getFollowers(userId)
          : await userService.getFollowing(userId);

      if (response.success) {
        setUsers(response.users);
      }
    } catch (error) {
      showError(`Failed to load ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (username) => {
    onClose();
    navigate(`/profile/${username}`);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="follow-modal-backdrop" onClick={handleBackdropClick}>
      <div className="follow-modal">
        <div className="follow-modal-header">
          <h2>{type === "followers" ? "Followers" : "Following"}</h2>
          <button className="follow-modal-close" onClick={onClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="follow-modal-body">
          {loading ? (
            <div className="follow-modal-loading">Loading...</div>
          ) : users.length === 0 ? (
            <div className="follow-modal-empty">
              <p>
                No {type === "followers" ? "followers" : "following"} yet
              </p>
            </div>
          ) : (
            <div className="follow-modal-list">
              {users.map((user) => (
                <div
                  key={user._id}
                  className="follow-modal-user"
                  onClick={() => handleUserClick(user.username)}
                >
                  <img
                    src={getUserAvatar(user)}
                    alt={user.username}
                    className="follow-modal-avatar"
                  />
                  <div className="follow-modal-info">
                    <h4>{user.username}</h4>
                    <p>{user.fullName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FollowListModal;
