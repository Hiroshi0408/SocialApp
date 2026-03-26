import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import PostCard from "../../components/PostCard/PostCard";
import Loading from "../../components/Loading/Loading";
import { userService, postService } from "../../api";
import { getUserAvatar, getId, showError, showSuccess } from "../../utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAvatarError } from "../../hooks/useAvatarError";

import "./Search.css";

function Search() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchType, setSearchType] = useState("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [searched, setSearched] = useState(false);
  const [friendshipStatuses, setFriendshipStatuses] = useState({});
  const { handleAvatarError, getAvatarSrc } = useAvatarError();

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qParam = (params.get("q") || "").trim();
    const typeParam = (params.get("type") || "users").trim();

    const typeToUse = typeParam === "hashtags" ? "hashtags" : "users";
    setSearchType(typeToUse);

    if (qParam) {
      setQuery(qParam);
      runSearch(qParam, typeToUse);
    } else if (typeToUse === "users") {
      loadSuggestedUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const runSearch = async (q, type = searchType) => {
    if (!q.trim()) return;

    setLoading(true);
    setSearched(true);

    try {
      if (type === "users") {
        const response = await userService.searchUsers(q);
        if (response.success) {
          setUsers(response.users);
          setPosts([]);

          const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
          const relationStatuses = {};

          await Promise.all(
            response.users.map(async (user) => {
              if (user._id === currentUser._id) {
                relationStatuses[user._id] = "self";
                return;
              }
              try {
                const statusRes = await userService.getFriendshipStatus(
                  user._id,
                );
                relationStatuses[user._id] = statusRes.status || "none";
              } catch {
                relationStatuses[user._id] = "none";
              }
            }),
          );

          setFriendshipStatuses(relationStatuses);
        }
      } else {
        const response = await postService.searchByHashtag(q);
        if (response.success) {
          setPosts(response.posts);
          setUsers([]);
        }
      }
    } catch (err) {
      console.error(t("search.searchError"), err);
      showError(err.response?.data?.message || t("search.searchError"));
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedUsers = async () => {
    setLoadingSuggested(true);
    try {
      // Assuming there's an API to get suggested users
      const response = await userService.getSuggestedUsers();
      if (response.success) {
        setSuggestedUsers(response.users);
        // Set follow statuses
        const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
        const relationStatuses = {};
        await Promise.all(
          response.users.map(async (user) => {
            if (user._id === currentUser._id) {
              relationStatuses[user._id] = "self";
              return;
            }
            try {
              const statusRes = await userService.getFriendshipStatus(user._id);
              relationStatuses[user._id] = statusRes.status || "none";
            } catch {
              relationStatuses[user._id] = "none";
            }
          }),
        );
        setFriendshipStatuses(relationStatuses);
      }
    } catch (err) {
      console.error("Failed to load suggested users", err);
    } finally {
      setLoadingSuggested(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    runSearch(query, searchType);
  };

  const getFriendActionLabel = (status) => {
    if (status === "friends") return t("friends.actions.friends");
    if (status === "outgoing_request") return t("friends.actions.sent");
    if (status === "incoming_request") return t("friends.actions.accept");
    return t("friends.actions.add");
  };

  const handleFriendAction = async (userId) => {
    try {
      const status = friendshipStatuses[userId] || "none";

      if (status === "friends") {
        await userService.unfriendUser(userId);
        setFriendshipStatuses((prev) => ({ ...prev, [userId]: "none" }));
        showSuccess(t("friends.toast.unfriended"));
      } else if (status === "outgoing_request") {
        await userService.cancelFriendRequest(userId);
        setFriendshipStatuses((prev) => ({ ...prev, [userId]: "none" }));
        showSuccess(t("friends.toast.canceled"));
      } else if (status === "incoming_request") {
        await userService.acceptFriendRequest(userId);
        setFriendshipStatuses((prev) => ({ ...prev, [userId]: "friends" }));
        showSuccess(t("friends.toast.accepted"));
      } else {
        await userService.sendFriendRequest(userId);
        setFriendshipStatuses((prev) => ({
          ...prev,
          [userId]: "outgoing_request",
        }));
        showSuccess(t("friends.toast.sent"));
      }
    } catch (error) {
      showError(error.response?.data?.message || t("profile.actionFailed"));
    }
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
  };

  const setTypeAndSyncUrl = (nextType) => {
    setSearchType(nextType);
    const params = new URLSearchParams(window.location.search);
    params.set("type", nextType);
    if (query.trim()) params.set("q", query.trim());
    navigate(`/search?${params.toString()}`);

    if (nextType === "users" && !query.trim()) {
      loadSuggestedUsers();
    }
  };

  return (
    <div className="search-page">
      <Sidebar />
      <div className="search-content-wrapper">
        <Header />
        <main className="search-main">
          <div className="search-container">
            <h2>{t("search.title")}</h2>

            <div className="search-tabs">
              <button
                className={searchType === "users" ? "active" : ""}
                onClick={() => setTypeAndSyncUrl("users")}
              >
                {t("search.usersTab")}
              </button>
              <button
                className={searchType === "hashtags" ? "active" : ""}
                onClick={() => setTypeAndSyncUrl("hashtags")}
              >
                {t("search.hashtagsTab")}
              </button>
            </div>

            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder={
                  searchType === "users"
                    ? t("search.searchUsersPlaceholder")
                    : t("search.searchHashtagsPlaceholder")
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit">{t("search.searchButton")}</button>
            </form>

            {loading && <Loading />}

            {!loading && !searched && searchType === "users" && (
              <div className="search-results">
                <h3>{t("search.suggestedUsers")}</h3>
                {loadingSuggested ? (
                  <Loading />
                ) : suggestedUsers.length === 0 ? (
                  <p className="no-results">{t("search.noSuggestedUsers")}</p>
                ) : (
                  <div className="users-list">
                    {suggestedUsers.map((user) => (
                      <div key={getId(user)} className="user-item">
                        <div
                          className="user-item-left"
                          onClick={() => handleUserClick(user.username)}
                        >
                          <img
                            src={getAvatarSrc(user, getUserAvatar)}
                            alt={user.username}
                            onError={() => handleAvatarError(user._id)}
                          />
                          <div className="user-info">
                            <h4>{user.fullName}</h4>
                            <p>@{user.username}</p>
                            <span>
                              {t("search.followersCount", {
                                count: user.followersCount,
                              })}
                            </span>
                          </div>
                        </div>
                        {friendshipStatuses[user._id] !== "self" && (
                          <button
                            className={`follow-btn ${
                              friendshipStatuses[user._id] === "friends" ||
                              friendshipStatuses[user._id] ===
                                "outgoing_request"
                                ? "following"
                                : ""
                            }`}
                            onClick={() => handleFriendAction(user._id)}
                          >
                            {getFriendActionLabel(friendshipStatuses[user._id])}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && searched && searchType === "users" && (
              <div className="search-results">
                {users.length === 0 ? (
                  <p className="no-results">{t("search.noUsersFound")}</p>
                ) : (
                  <div className="users-list">
                    {users.map((user) => (
                      <div key={getId(user)} className="user-item">
                        <div
                          className="user-item-left"
                          onClick={() => handleUserClick(user.username)}
                        >
                          <img
                            src={getAvatarSrc(user, getUserAvatar)}
                            alt={user.username}
                            onError={() => handleAvatarError(user._id)}
                          />
                          <div className="user-info">
                            <h4>{user.fullName}</h4>
                            <p>@{user.username}</p>
                            <span>
                              {t("search.followersCount", {
                                count: user.followersCount,
                              })}
                            </span>
                          </div>
                        </div>
                        {friendshipStatuses[user._id] !== "self" && (
                          <button
                            className={`follow-btn ${
                              friendshipStatuses[user._id] === "friends" ||
                              friendshipStatuses[user._id] ===
                                "outgoing_request"
                                ? "following"
                                : ""
                            }`}
                            onClick={() => handleFriendAction(user._id)}
                          >
                            {getFriendActionLabel(friendshipStatuses[user._id])}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && searched && searchType === "hashtags" && (
              <div className="search-results">
                {posts.length === 0 ? (
                  <p className="no-results">{t("search.noPostsFound")}</p>
                ) : (
                  <div className="posts-list">
                    {posts.map((post) => (
                      <PostCard key={getId(post)} post={post} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Search;
