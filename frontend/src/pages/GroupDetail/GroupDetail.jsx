import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import PostCard from "../../components/PostCard/PostCard";
import CreatePostModal from "../../components/CreatePostModal/CreatePostModal";
import EditGroupModal from "../../components/EditGroupModal/EditGroupModal";
import ConfirmDialog from "../../components/ConfirmDialog/ConfirmDialog";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { groupService, postService } from "../../api";
import { showError, showSuccess } from "../../utils/toast";
import { getUserAvatar } from "../../utils";
import "./GroupDetail.css";

function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Confirm dialogs: 1 state chung cho nhiều action tránh bùng component
  const [confirm, setConfirm] = useState(null); // { title, message, action, dangerous }

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);
      const res = await groupService.getGroupById(groupId);
      if (res?.success) setGroup(res.group);
    } catch (err) {
      showError(err?.response?.data?.message || t("groupDetail.loadFailed"));
      if (err?.response?.status === 404) navigate("/groups");
    } finally {
      setLoading(false);
    }
  }, [groupId, navigate, t]);

  const fetchPosts = useCallback(async () => {
    if (!group?.isMember) {
      setPosts([]);
      return;
    }
    try {
      setPostsLoading(true);
      const res = await postService.getGroupFeed(groupId);
      if (res?.success) setPosts(res.posts || []);
    } catch (err) {
      showError(err?.response?.data?.message || t("groupDetail.postsLoadFailed"));
    } finally {
      setPostsLoading(false);
    }
  }, [group?.isMember, groupId, t]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  useEffect(() => {
    if (tab === "posts") fetchPosts();
  }, [tab, fetchPosts]);

  const handlePostCreated = (newPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p._id !== postId && p.id !== postId));
  };

  const handleJoin = async () => {
    try {
      const res = await groupService.joinGroup(groupId);
      if (res?.success) {
        showSuccess(t("groupDetail.joined"));
        fetchGroup();
      }
    } catch (err) {
      showError(err?.response?.data?.message || t("groupDetail.joinFailed"));
    }
  };

  const handleLeave = () => {
    setConfirm({
      title: t("groupDetail.leaveTitle"),
      message: t("groupDetail.leaveConfirm"),
      action: async () => {
        try {
          const res = await groupService.leaveGroup(groupId);
          if (res?.success) {
            showSuccess(t("groupDetail.leftGroup"));
            if (res.deleted) navigate("/groups");
            else fetchGroup();
          }
        } catch (err) {
          showError(err?.response?.data?.message || t("groupDetail.leaveFailed"));
        }
      },
      dangerous: true,
    });
  };

  const handleDelete = () => {
    setConfirm({
      title: t("groupDetail.deleteTitle"),
      message: t("groupDetail.deleteConfirm"),
      action: async () => {
        try {
          const res = await groupService.deleteGroup(groupId);
          if (res?.success) {
            showSuccess(t("groupDetail.deleted"));
            navigate("/groups");
          }
        } catch (err) {
          showError(err?.response?.data?.message || t("groupDetail.deleteFailed"));
        }
      },
      dangerous: true,
    });
  };

  const handleKick = (member) => {
    setConfirm({
      title: t("groupDetail.kickTitle"),
      message: t("groupDetail.kickConfirm", {
        name: member.fullName || member.username,
      }),
      action: async () => {
        try {
          const res = await groupService.kickMember(groupId, member._id);
          if (res?.success) {
            showSuccess(t("groupDetail.kicked"));
            fetchGroup();
          }
        } catch (err) {
          showError(err?.response?.data?.message || t("groupDetail.kickFailed"));
        }
      },
      dangerous: true,
    });
  };

  const handleTransfer = (member) => {
    setConfirm({
      title: t("groupDetail.transferTitle"),
      message: t("groupDetail.transferConfirm", {
        name: member.fullName || member.username,
      }),
      action: async () => {
        try {
          const res = await groupService.transferOwnership(groupId, member._id);
          if (res?.success) {
            showSuccess(t("groupDetail.transferred"));
            fetchGroup();
          }
        } catch (err) {
          showError(
            err?.response?.data?.message || t("groupDetail.transferFailed"),
          );
        }
      },
      dangerous: true,
    });
  };

  if (loading) {
    return (
      <div className="group-detail-page">
        <Sidebar />
        <div className="group-detail-wrapper">
          <Header />
          <main className="group-detail-main">
            <p className="group-detail-empty">{t("common.loading")}</p>
          </main>
        </div>
      </div>
    );
  }

  if (!group) return null;

  const creatorId =
    group.creator?._id?.toString?.() || group.creator?.toString?.();

  return (
    <div className="group-detail-page">
      <Sidebar />
      <div className="group-detail-wrapper">
        <Header />
        <main className="group-detail-main">
          <section className="group-detail-hero">
            <div className="group-detail-cover">
              {group.image ? (
                <img src={group.image} alt={group.name} />
              ) : (
                <div className="group-detail-cover-placeholder" />
              )}
            </div>

            <div className="group-detail-head">
              <div className="group-detail-title">
                <h1>{group.name}</h1>
                {group.isOfficial && (
                  <VerifiedBadge
                    size="md"
                    title={t("groupDetail.officialBadge")}
                  />
                )}
              </div>
              <div className="group-detail-meta">
                <span>
                  {group.membersCount} {t("groupDetail.members")}
                </span>
                {group.isOfficial && group.organizationSlug && (
                  <Link
                    to={`/org/${group.organizationSlug}`}
                    className="group-detail-org-link"
                  >
                    {t("groupDetail.viewOrganization")} →
                  </Link>
                )}
              </div>

              <div className="group-detail-actions">
                {group.isMember ? (
                  <button className="btn-secondary" onClick={handleLeave}>
                    {t("groupDetail.leave")}
                  </button>
                ) : (
                  <button className="btn-primary" onClick={handleJoin}>
                    {t("groupDetail.join")}
                  </button>
                )}

                {group.isCreator && (
                  <div className="group-detail-menu-wrap">
                    <button
                      className="btn-icon"
                      onClick={() => setIsMenuOpen((v) => !v)}
                      aria-label="More"
                    >
                      ⋯
                    </button>
                    {isMenuOpen && (
                      <div
                        className="group-detail-menu"
                        onMouseLeave={() => setIsMenuOpen(false)}
                      >
                        <button
                          onClick={() => {
                            setIsEditOpen(true);
                            setIsMenuOpen(false);
                          }}
                        >
                          {t("groupDetail.edit")}
                        </button>
                        {!group.isOfficial && (
                          <button
                            className="danger"
                            onClick={() => {
                              handleDelete();
                              setIsMenuOpen(false);
                            }}
                          >
                            {t("groupDetail.delete")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <nav className="group-detail-tabs">
            <button
              className={tab === "posts" ? "active" : ""}
              onClick={() => setTab("posts")}
            >
              {t("groupDetail.tabs.posts")}
            </button>
            <button
              className={tab === "members" ? "active" : ""}
              onClick={() => setTab("members")}
            >
              {t("groupDetail.tabs.members")} ({group.membersCount})
            </button>
            <button
              className={tab === "about" ? "active" : ""}
              onClick={() => setTab("about")}
            >
              {t("groupDetail.tabs.about")}
            </button>
          </nav>

          <section className="group-detail-body">
            {tab === "posts" && (
              <div className="group-posts-tab">
                {group.isMember ? (
                  <button
                    className="btn-primary"
                    onClick={() => setIsCreateOpen(true)}
                  >
                    + {t("groupDetail.createPost")}
                  </button>
                ) : (
                  <p className="group-detail-empty">
                    {t("groupDetail.joinToSeePosts")}
                  </p>
                )}
                {group.isMember && (
                  <div className="group-posts-list">
                    {postsLoading && (
                      <p className="group-detail-empty">{t("common.loading")}</p>
                    )}
                    {!postsLoading && posts.length === 0 && (
                      <p className="group-detail-empty">
                        {t("groupDetail.noPosts")}
                      </p>
                    )}
                    {posts.map((post) => (
                      <PostCard
                        key={post._id || post.id}
                        post={post}
                        onPostDeleted={handlePostDeleted}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === "members" && (
              <div className="group-members-tab">
                <ul className="group-members-list">
                  {(group.membersList || []).map((m) => {
                    const memberId = m._id?.toString?.() || m.toString();
                    const isOwner = memberId === creatorId;

                    return (
                      <li key={memberId} className="group-member-item">
                        <Link
                          to={`/profile/${m.username}`}
                          className="group-member-link"
                        >
                          <img src={getUserAvatar(m)} alt={m.username} />
                          <div>
                            <div className="group-member-name">
                              {m.fullName || m.username}
                              {isOwner && (
                                <span className="group-member-badge">
                                  {t("groupDetail.owner")}
                                </span>
                              )}
                            </div>
                            <div className="group-member-username">
                              @{m.username}
                            </div>
                          </div>
                        </Link>
                        {group.isCreator && !isOwner && (
                          <div className="group-member-actions">
                            <button
                              className="btn-link"
                              onClick={() => handleTransfer(m)}
                            >
                              {t("groupDetail.makeOwner")}
                            </button>
                            <button
                              className="btn-link danger"
                              onClick={() => handleKick(m)}
                            >
                              {t("groupDetail.kick")}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {tab === "about" && (
              <div className="group-about-tab">
                <h3>{t("groupDetail.description")}</h3>
                <p>
                  {group.description || t("groupDetail.noDescription")}
                </p>

                <h3>{t("groupDetail.createdBy")}</h3>
                {group.creator && (
                  <Link
                    to={`/profile/${group.creator.username}`}
                    className="group-creator-link"
                  >
                    <img
                      src={getUserAvatar(group.creator)}
                      alt={group.creator.username}
                    />
                    <span>
                      {group.creator.fullName || group.creator.username}
                    </span>
                  </Link>
                )}

                <h3>{t("groupDetail.createdAt")}</h3>
                <p>{new Date(group.createdAt).toLocaleDateString()}</p>

                {group.isOfficial && (
                  <p className="group-official-note">
                    {t("groupDetail.officialNote")}
                  </p>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      <CreatePostModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={handlePostCreated}
        groupId={groupId}
      />

      <EditGroupModal
        isOpen={isEditOpen}
        group={group}
        onClose={() => setIsEditOpen(false)}
        onUpdated={(updated) => {
          setGroup(updated);
          setIsEditOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        isDangerous={confirm?.dangerous}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.action) confirm.action();
          setConfirm(null);
        }}
      />
    </div>
  );
}

export default GroupDetail;
