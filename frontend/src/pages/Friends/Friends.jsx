import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import Loading from "../../components/Loading/Loading";
import { userService } from "../../api";
import { getUserAvatar, getId } from "../../utils";
import { showError, showSuccess } from "../../utils/toast";
import "./Friends.css";

function Friends() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incoming");
  const [loading, setLoading] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [friends, setFriends] = useState([]);

  const currentList = useMemo(() => {
    if (activeTab === "incoming") return incoming;
    if (activeTab === "outgoing") return outgoing;
    return friends;
  }, [activeTab, incoming, outgoing, friends]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [incomingRes, outgoingRes, friendsRes] = await Promise.all([
        userService.getIncomingFriendRequests(),
        userService.getOutgoingFriendRequests(),
        userService.getFriends(),
      ]);

      setIncoming(incomingRes.users || []);
      setOutgoing(outgoingRes.users || []);
      setFriends(friendsRes.users || []);
    } catch (error) {
      showError(error.response?.data?.message || t("friends.errors.loadData"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAccept = async (userId) => {
    try {
      await userService.acceptFriendRequest(userId);
      showSuccess(t("friends.toast.accepted"));
      loadData();
    } catch (error) {
      showError(error.response?.data?.message || t("friends.errors.accept"));
    }
  };

  const handleReject = async (userId) => {
    try {
      await userService.rejectFriendRequest(userId);
      showSuccess(t("friends.toast.rejected"));
      loadData();
    } catch (error) {
      showError(error.response?.data?.message || t("friends.errors.reject"));
    }
  };

  const handleCancel = async (userId) => {
    try {
      await userService.cancelFriendRequest(userId);
      showSuccess(t("friends.toast.canceled"));
      loadData();
    } catch (error) {
      showError(error.response?.data?.message || t("friends.errors.cancel"));
    }
  };

  const handleUnfriend = async (userId) => {
    try {
      await userService.unfriendUser(userId);
      showSuccess(t("friends.toast.unfriended"));
      loadData();
    } catch (error) {
      showError(error.response?.data?.message || t("friends.errors.unfriend"));
    }
  };

  const renderActions = (user) => {
    const userId = getId(user);

    if (activeTab === "incoming") {
      return (
        <div className="friends-actions">
          <button
            className="friends-btn primary"
            onClick={() => handleAccept(userId)}
          >
            {t("friends.actions.accept")}
          </button>
          <button className="friends-btn" onClick={() => handleReject(userId)}>
            {t("friends.actions.reject")}
          </button>
        </div>
      );
    }

    if (activeTab === "outgoing") {
      return (
        <div className="friends-actions">
          <button className="friends-btn" onClick={() => handleCancel(userId)}>
            {t("friends.actions.cancel")}
          </button>
        </div>
      );
    }

    return (
      <div className="friends-actions">
        <button className="friends-btn" onClick={() => handleUnfriend(userId)}>
          {t("friends.actions.unfriend")}
        </button>
      </div>
    );
  };

  return (
    <div className="friends-page">
      <Sidebar />
      <div className="friends-content-wrapper">
        <Header />
        <main className="friends-main">
          <div className="friends-container">
            <h2>{t("friends.title")}</h2>

            <div className="friends-tabs">
              <button
                className={activeTab === "incoming" ? "active" : ""}
                onClick={() => setActiveTab("incoming")}
              >
                {t("friends.tabs.incoming", { count: incoming.length })}
              </button>
              <button
                className={activeTab === "outgoing" ? "active" : ""}
                onClick={() => setActiveTab("outgoing")}
              >
                {t("friends.tabs.sent", { count: outgoing.length })}
              </button>
              <button
                className={activeTab === "friends" ? "active" : ""}
                onClick={() => setActiveTab("friends")}
              >
                {t("friends.tabs.friends", { count: friends.length })}
              </button>
            </div>

            {loading ? (
              <Loading />
            ) : currentList.length === 0 ? (
              <div className="friends-empty">{t("friends.empty")}</div>
            ) : (
              <div className="friends-list">
                {currentList.map((user) => (
                  <div className="friends-item" key={getId(user)}>
                    <button
                      className="friends-user"
                      onClick={() => navigate(`/profile/${user.username}`)}
                    >
                      <img src={getUserAvatar(user)} alt={user.username} />
                      <div>
                        <h4>{user.fullName || user.username}</h4>
                        <p>@{user.username}</p>
                      </div>
                    </button>
                    {renderActions(user)}
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

export default Friends;
