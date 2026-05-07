import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import PostModal from "../../components/PostModal/PostModal";
import FollowListModal from "../../components/FollowListModal/FollowListModal";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import { useAuth } from "../../contexts/AuthContext";
import { userService, postService, saveService, chatService } from "../../api";
import { showError, showSuccess } from "../../utils/toast";
import {
  normalizeApiResponse,
  normalizeArrayResponse,
  getId,
  getUserFullName,
  getUserAvatar,
  getFollowersCount,
  getFollowingCount,
} from "../../utils";
import "./Profile.css";
import Sidebar from "../../components/Sidebar/Sidebar";

function Profile() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { username: usernameParam } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [userProfile, setUserProfile] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [followListModal, setFollowListModal] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState("none");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [friendMenuOpen, setFriendMenuOpen] = useState(false);
  const friendMenuRef = useRef(null);
  // Confirm dialog cho action phá hủy: { open, title, message, confirmText, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  const targetUsername = usernameParam || currentUser?.username;
  const isOwnProfile =
    !usernameParam || targetUsername === currentUser?.username;

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "saved") {
      setActiveTab("saved");
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!currentUser) {
        return;
      }

      if (!targetUsername) {
        setError(t("profile.usernameNotFound"));
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const profileData = await userService.getUserProfile(targetUsername);
        const normalizedProfile = normalizeApiResponse(profileData, "user");

        if (!normalizedProfile) {
          setError(t("profile.loadProfileError"));
          setLoading(false);
          return;
        }

        setUserProfile(normalizedProfile);
        setFriendshipStatus(normalizedProfile.friendship?.status || "none");
        setIsFollowing(!!normalizedProfile.isFollowing);

        const userId = normalizedProfile._id || normalizedProfile.id;
        if (userId) {
          const postsData = await postService.getUserPosts(userId);
          setUserPosts(normalizeArrayResponse(postsData, "posts"));
        }
      } catch (error) {
        console.error("Profile load error:", error);
        const errorMessage =
          error.response?.data?.message || t("profile.loadProfileError");
        setError(errorMessage);
        showError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [targetUsername, currentUser, t]);

  // Lắng nghe event "post:created" từ Sidebar — prepend vào tab Posts của
  // chính mình. Profile của user khác không nhận (post của mình không hiện
  // trên profile họ).
  useEffect(() => {
    if (!isOwnProfile) return;
    const handleNewPost = (e) => {
      const newPost = e.detail;
      if (!newPost) return;
      setUserPosts((prev) => {
        const newId = getId(newPost);
        if (prev.some((p) => getId(p) === newId)) return prev;
        return [newPost, ...prev];
      });
    };
    window.addEventListener("post:created", handleNewPost);
    return () => window.removeEventListener("post:created", handleNewPost);
  }, [isOwnProfile]);

  const loadSavedPosts = useCallback(async () => {
    try {
      const response = await saveService.getSavedPosts();
      if (response.success) {
        setSavedPosts(response.posts);
      }
    } catch (error) {
      showError(t("profile.loadSavedError"));
    }
  }, [t]);

  const loadTaggedPosts = useCallback(async () => {
    if (!userProfile) return;
    try {
      const userId = userProfile._id || userProfile.id;
      const response = await postService.getTaggedPosts(userId);
      if (response.success) {
        setTaggedPosts(response.posts);
      }
    } catch (error) {
      showError(t("profile.loadTaggedError"));
    }
  }, [userProfile, t]);

  useEffect(() => {
    if (activeTab === "saved" && isOwnProfile) {
      loadSavedPosts();
    }
  }, [activeTab, isOwnProfile, loadSavedPosts]);

  // Click ngoài → đóng dropdown menu Friends
  useEffect(() => {
    if (!friendMenuOpen) return;
    const handler = (e) => {
      if (friendMenuRef.current && !friendMenuRef.current.contains(e.target)) {
        setFriendMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [friendMenuOpen]);

  useEffect(() => {
    if (activeTab === "tagged") {
      loadTaggedPosts();
    }
  }, [activeTab, loadTaggedPosts]);

  // Action không phá hủy — gọi thẳng. Add friend / Accept request.
  const handleAddFriend = async () => {
    if (!userProfile || friendActionLoading) return;
    const userId = userProfile._id || userProfile.id;
    setFriendActionLoading(true);
    try {
      await userService.sendFriendRequest(userId);
      setFriendshipStatus("outgoing_request");
      showSuccess(t("friends.toast.sent"));
    } catch (error) {
      showError(error.response?.data?.message || t("profile.actionFailed"));
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!userProfile || friendActionLoading) return;
    const userId = userProfile._id || userProfile.id;
    setFriendActionLoading(true);
    try {
      await userService.acceptFriendRequest(userId);
      setFriendshipStatus("friends");
      setUserProfile((prev) => ({
        ...prev,
        friendsCount: (prev.friendsCount || 0) + 1,
      }));
      showSuccess(t("friends.toast.accepted"));
    } catch (error) {
      showError(error.response?.data?.message || t("profile.actionFailed"));
    } finally {
      setFriendActionLoading(false);
    }
  };

  const handleDeclineFriend = async () => {
    if (!userProfile || friendActionLoading) return;
    const userId = userProfile._id || userProfile.id;
    setFriendActionLoading(true);
    try {
      await userService.rejectFriendRequest(userId);
      setFriendshipStatus("none");
      showSuccess(t("friends.toast.rejected"));
    } catch (error) {
      showError(error.response?.data?.message || t("profile.actionFailed"));
    } finally {
      setFriendActionLoading(false);
    }
  };

  // Action phá hủy — confirm trước khi gọi API. ConfirmDialog tự đóng sau onConfirm.
  const requestUnfriend = () => {
    if (!userProfile) return;
    setFriendMenuOpen(false);
    setConfirmDialog({
      open: true,
      title: t("profile.confirm.unfriendTitle"),
      message: t("profile.confirm.unfriendMessage", {
        username: userProfile.username,
      }),
      confirmText: t("profile.confirm.unfriendConfirm"),
      isDangerous: true,
      onConfirm: async () => {
        const userId = userProfile._id || userProfile.id;
        setFriendActionLoading(true);
        try {
          await userService.unfriendUser(userId);
          setFriendshipStatus("none");
          setUserProfile((prev) => ({
            ...prev,
            friendsCount: Math.max(0, (prev.friendsCount || 0) - 1),
          }));
          showSuccess(t("friends.toast.unfriended"));
        } catch (error) {
          showError(error.response?.data?.message || t("profile.actionFailed"));
        } finally {
          setFriendActionLoading(false);
        }
      },
    });
  };

  const requestCancelRequest = () => {
    if (!userProfile) return;
    setConfirmDialog({
      open: true,
      title: t("profile.confirm.cancelRequestTitle"),
      message: t("profile.confirm.cancelRequestMessage", {
        username: userProfile.username,
      }),
      confirmText: t("profile.confirm.cancelRequestConfirm"),
      isDangerous: false,
      onConfirm: async () => {
        const userId = userProfile._id || userProfile.id;
        setFriendActionLoading(true);
        try {
          await userService.cancelFriendRequest(userId);
          setFriendshipStatus("none");
          showSuccess(t("friends.toast.canceled"));
        } catch (error) {
          showError(error.response?.data?.message || t("profile.actionFailed"));
        } finally {
          setFriendActionLoading(false);
        }
      },
    });
  };

  // Follow: action không phá hủy gọi thẳng; Unfollow đi qua confirm.
  const handleFollowClick = async () => {
    if (!userProfile || followLoading) return;
    const userId = userProfile._id || userProfile.id;

    if (isFollowing) {
      setConfirmDialog({
        open: true,
        title: t("profile.confirm.unfollowTitle"),
        message: t("profile.confirm.unfollowMessage", {
          username: userProfile.username,
        }),
        confirmText: t("profile.confirm.unfollowConfirm"),
        isDangerous: false,
        onConfirm: async () => {
          setFollowLoading(true);
          try {
            await userService.unfollowUser(userId);
            setIsFollowing(false);
            setUserProfile((prev) => ({
              ...prev,
              followersCount: Math.max(0, (prev.followersCount || 0) - 1),
            }));
            showSuccess(t("profile.unfollowedSuccess"));
          } catch (error) {
            showError(error.response?.data?.message || t("profile.actionFailed"));
          } finally {
            setFollowLoading(false);
          }
        },
      });
      return;
    }

    setFollowLoading(true);
    try {
      await userService.followUser(userId);
      setIsFollowing(true);
      setUserProfile((prev) => ({
        ...prev,
        followersCount: (prev.followersCount || 0) + 1,
      }));
      showSuccess(t("profile.followedSuccess"));
    } catch (error) {
      showError(error.response?.data?.message || t("profile.actionFailed"));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessageClick = async () => {
    if (!userProfile) return;

    try {
      const userId = userProfile._id || userProfile.id;
      const response = await chatService.getOrCreateConversation(userId);

      if (response.success) {
        navigate("/messages");
      }
    } catch (error) {
      showError(t("profile.startConversationError"));
    }
  };

  const openPostModal = (post) => {
    setSelectedPost(post);
  };

  const closePostModal = () => {
    setSelectedPost(null);
  };

  const handleOpenFollowList = (type) => {
    setFollowListModal({
      type,
      userId: userProfile._id || userProfile.id,
    });
  };

  const handleCloseFollowList = () => {
    setFollowListModal(null);
  };

  if (loading) {
    return (
      <div className="profile-page">
        <Sidebar />
        <div className="profile-content-wrapper">
          <Header />
          <main className="profile-main">
            <div className="profile-container">
              <div style={{ textAlign: "center", padding: "40px" }}>
                {t("profile.loading")}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !userProfile) {
    return (
      <div className="profile-page">
        <Sidebar />
        <div className="profile-content-wrapper">
          <Header />
          <main className="profile-main">
            <div className="profile-container">
              <div style={{ textAlign: "center", padding: "40px" }}>
                <h3>{error || t("profile.notFound")}</h3>
                <button
                  onClick={() => navigate("/home")}
                  style={{
                    marginTop: "20px",
                    padding: "10px 20px",
                    background: "var(--primary-color)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                  }}
                >
                  {t("profile.goToHome")}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Sidebar />

      <div className="profile-content-wrapper">
        <Header />

        <main className="profile-main">
          <div className="profile-container">
            <header className="profile-header">
              <div className="profile-avatar-container">
                <img
                  src={getUserAvatar(userProfile)}
                  alt={userProfile.username}
                  className="profile-avatar"
                />
              </div>

              <div className="profile-info">
                <div className="profile-top">
                  <h2 className="profile-username">{userProfile.username}</h2>
                  {isOwnProfile ? (
                    <button
                      className="profile-btn profile-btn--primary"
                      onClick={() => navigate("/settings")}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      {t("profile.editProfile")}
                    </button>
                  ) : (
                    <div className="profile-actions">
                      {/* Friend area — switch theo friendshipStatus */}
                      {friendshipStatus === "none" && (
                        <button
                          className="profile-btn profile-btn--primary"
                          onClick={handleAddFriend}
                          disabled={friendActionLoading}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="8.5" cy="7" r="4" />
                            <path d="M20 8v6M23 11h-6" />
                          </svg>
                          {t("friends.actions.add")}
                        </button>
                      )}

                      {friendshipStatus === "outgoing_request" && (
                        <button
                          className="profile-btn profile-btn--outline"
                          onClick={requestCancelRequest}
                          disabled={friendActionLoading}
                          title={t("friends.actions.cancel")}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {t("friends.actions.sent")}
                        </button>
                      )}

                      {friendshipStatus === "incoming_request" && (
                        <>
                          <button
                            className="profile-btn profile-btn--primary"
                            onClick={handleAcceptFriend}
                            disabled={friendActionLoading}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t("friends.actions.accept")}
                          </button>
                          <button
                            className="profile-btn profile-btn--outline"
                            onClick={handleDeclineFriend}
                            disabled={friendActionLoading}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            {t("friends.actions.reject")}
                          </button>
                        </>
                      )}

                      {friendshipStatus === "friends" && (
                        <div className="profile-friend-menu" ref={friendMenuRef}>
                          <button
                            className="profile-btn profile-btn--outline"
                            onClick={() => setFriendMenuOpen((v) => !v)}
                            disabled={friendActionLoading}
                            aria-haspopup="true"
                            aria-expanded={friendMenuOpen}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="8.5" cy="7" r="4" />
                              <polyline points="17 11 19 13 23 9" />
                            </svg>
                            {t("friends.actions.friends")}
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {friendMenuOpen && (
                            <div className="profile-friend-dropdown" role="menu">
                              <button
                                className="profile-friend-dropdown-item danger"
                                onClick={requestUnfriend}
                                role="menuitem"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                  <circle cx="8.5" cy="7" r="4" />
                                  <line x1="18" y1="8" x2="23" y2="13" />
                                  <line x1="23" y1="8" x2="18" y2="13" />
                                </svg>
                                {t("friends.actions.unfriend")}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Follow button — độc lập với friend status */}
                      <button
                        className={`profile-btn ${isFollowing ? "profile-btn--outline" : "profile-btn--outline-primary"}`}
                        onClick={handleFollowClick}
                        disabled={followLoading}
                      >
                        {isFollowing ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t("profile.followingButton")}
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {t("profile.followButton")}
                          </>
                        )}
                      </button>

                      {/* Message button */}
                      <button
                        className="profile-btn profile-btn--outline"
                        onClick={handleMessageClick}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {t("profile.messageButton")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="profile-stats">
                  <div className="stat-item">
                    <span className="stat-number">{userPosts.length}</span>
                    <span className="stat-label">{t("profile.posts")}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">
                      {(userProfile.friendsCount || 0).toLocaleString()}
                    </span>
                    <span className="stat-label">{t("profile.friends")}</span>
                  </div>
                  <button
                    className="stat-item stat-button"
                    onClick={() => handleOpenFollowList("followers")}
                  >
                    <span className="stat-number">
                      {getFollowersCount(userProfile).toLocaleString()}
                    </span>
                    <span className="stat-label">{t("profile.followers")}</span>
                  </button>
                  <button
                    className="stat-item stat-button"
                    onClick={() => handleOpenFollowList("following")}
                  >
                    <span className="stat-number">
                      {getFollowingCount(userProfile)}
                    </span>
                    <span className="stat-label">{t("profile.following")}</span>
                  </button>
                </div>

                <div className="profile-bio">
                  <p className="profile-fullname">
                    {getUserFullName(userProfile)}
                  </p>
                  {userProfile.bio && (
                    <p className="profile-bio-text">{userProfile.bio}</p>
                  )}
                  {userProfile.website && (
                    <a
                      href={userProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="profile-website"
                    >
                      {userProfile.website}
                    </a>
                  )}
                </div>
              </div>
            </header>

            <div className="profile-tabs">
              <button
                className={`profile-tab ${
                  activeTab === "posts" ? "active" : ""
                }`}
                onClick={() => setActiveTab("posts")}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                <span>{t("profile.postsTab")}</span>
              </button>
              {isOwnProfile && (
                <button
                  className={`profile-tab ${
                    activeTab === "saved" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("saved")}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{t("profile.savedTab")}</span>
                </button>
              )}
              <button
                className={`profile-tab ${
                  activeTab === "tagged" ? "active" : ""
                }`}
                onClick={() => setActiveTab("tagged")}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 5.4 7.9 13.9 8 14 .1-.1 8-8.6 8-14z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{t("profile.taggedTab")}</span>
              </button>
            </div>

            {activeTab === "posts" && (
              <>
                {userPosts.length === 0 ? (
                  <div className="profile-empty">
                    <div className="empty-icon">
                      <svg
                        width="62"
                        height="62"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" />
                      </svg>
                    </div>
                    <h3>{t("profile.noPosts")}</h3>
                    <p>{t("profile.noPostsDescription")}</p>
                  </div>
                ) : (
                  <div className="profile-posts-grid">
                    {userPosts.map((post) => (
                      <div
                        key={getId(post)}
                        className="profile-post-item"
                        onClick={() => openPostModal(post)}
                      >
                        {post.mediaType === "video" && post.video ? (
                          <>
                            <video src={post.video} preload="metadata" />
                            <div className="video-indicator">
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img src={post.image} alt={t("profile.postAlt")} />
                        )}
                        <div className="profile-post-overlay">
                          <div className="overlay-stats">
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              {post.likes}
                            </span>
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                              {post.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "saved" && isOwnProfile && (
              <>
                {savedPosts.length === 0 ? (
                  <div className="profile-empty">
                    <div className="empty-icon">
                      <svg
                        width="62"
                        height="62"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <h3>{t("profile.noSaved")}</h3>
                    <p>{t("profile.noSavedDescription")}</p>
                  </div>
                ) : (
                  <div className="profile-posts-grid">
                    {savedPosts.map((post) => (
                      <div
                        key={getId(post)}
                        className="profile-post-item"
                        onClick={() => openPostModal(post)}
                      >
                        {post.mediaType === "video" && post.video ? (
                          <>
                            <video src={post.video} preload="metadata" />
                            <div className="video-indicator">
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img src={post.image} alt={t("profile.postAlt")} />
                        )}
                        <div className="profile-post-overlay">
                          <div className="overlay-stats">
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              {post.likes}
                            </span>
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                              {post.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "tagged" && (
              <>
                {taggedPosts.length === 0 ? (
                  <div className="profile-empty">
                    <div className="empty-icon">
                      <svg
                        width="62"
                        height="62"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 5.4 7.9 13.9 8 14 .1-.1 8-8.6 8-14z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <h3>{t("profile.noTagged")}</h3>
                    <p>{t("profile.noTaggedDescription")}</p>
                  </div>
                ) : (
                  <div className="profile-posts-grid">
                    {taggedPosts.map((post) => (
                      <div
                        key={getId(post)}
                        className="profile-post-item"
                        onClick={() => openPostModal(post)}
                      >
                        {post.mediaType === "video" && post.video ? (
                          <>
                            <video src={post.video} preload="metadata" />
                            <div className="video-indicator">
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </>
                        ) : (
                          <img src={post.image} alt={t("profile.postAlt")} />
                        )}
                        <div className="profile-post-overlay">
                          <div className="overlay-stats">
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              {post.likes}
                            </span>
                            <span className="overlay-stat">
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="white"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                              {post.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {selectedPost && (
        <PostModal post={selectedPost} onClose={closePostModal} />
      )}

      {followListModal && (
        <FollowListModal
          type={followListModal.type}
          userId={followListModal.userId}
          onClose={handleCloseFollowList}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false })}
        onConfirm={() => {
          confirmDialog.onConfirm?.();
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDangerous={confirmDialog.isDangerous}
      />
    </div>
  );
}

export default Profile;
