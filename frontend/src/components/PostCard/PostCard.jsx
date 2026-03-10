import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import postService from "../../api/postService";
import { saveService } from "../../api";
import {
  getId,
  getUserAvatar,
  formatTimestamp,
  showError,
  showSuccess,
} from "../../utils";
import { useAuth } from "../../contexts/AuthContext";
import TextWithMentions from "../TextWithMentions/TextWithMentions";
import VideoPlayer from "../VideoPlayer/VideoPlayer";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./PostCard.css";
import PostModal from "../PostModal/PostModal";

function PostCard({ post, onPostDeleted }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [isLiked, setIsLiked] = useState(post.isLiked);
  const [isSaved, setIsSaved] = useState(post.isSaved);
  const [likes, setLikes] = useState(post.likes);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.commentsList || []);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [allCommentsLoaded, setAllCommentsLoaded] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [caption, setCaption] = useState(post.caption || "");
  const [location, setLocation] = useState(post.location || "");
  const [editCaption, setEditCaption] = useState(post.caption || "");
  const [editLocation, setEditLocation] = useState(post.location || "");
  const [isEditing, setIsEditing] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [commentToDelete, setCommentToDelete] = useState(null);
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [commentReplies, setCommentReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState(new Set());
  const menuRef = useRef(null);
  const [selectedPost, setSelectedPost] = useState(null);

  const closePostModal = () => {
    setSelectedPost(null);
  };
  const openPostModal = (post) => {
    setSelectedPost(post);
  };

  const postId = useMemo(() => getId(post), [post]);
  const userAvatar = useMemo(() => getUserAvatar(post.user), [post.user]);
  const postTimestamp = useMemo(
    () => formatTimestamp(post.createdAt || post.timestamp),
    [post.createdAt, post.timestamp],
  );

  // Sync props to state when post changes
  useEffect(() => {
    setIsLiked(post.isLiked);
    setLikes(post.likes);
    setIsSaved(post.isSaved);
    setCommentsCount(post.comments);
  }, [post.isLiked, post.likes, post.isSaved, post.comments]);

  const handleLike = useCallback(async () => {
    if (isLiking) return;

    const prevIsLiked = isLiked;
    const prevLikes = likes;

    try {
      setIsLiking(true);
      setIsLiked(!prevIsLiked);
      setLikes(prevIsLiked ? prevLikes - 1 : prevLikes + 1);

      await postService.toggleLike(postId);
    } catch (error) {
      setIsLiked(prevIsLiked);
      setLikes(prevLikes);
      showError(t("postCard.updateLikeError"));
    } finally {
      setIsLiking(false);
    }
  }, [isLiked, likes, postId, t]);

  const handleDoubleClick = useCallback(
    (e) => {
      if (e.target.tagName === "VIDEO") return;
      if (!isLiked) {
        handleLike();
      }
    },
    [isLiked, handleLike],
  );

  const handleSave = useCallback(async () => {
    const previousSavedState = isSaved;

    try {
      setIsSaved(!isSaved);

      if (isSaved) {
        await saveService.unsavePost(postId);
      } else {
        await saveService.savePost(postId);
      }
    } catch (error) {
      setIsSaved(previousSavedState);
      showError(t("postCard.saveError"));
    }
  }, [isSaved, postId, t]);

  const handleShare = useCallback(async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: t("postCard.shareTitle", { username: post.user.username }),
          text: post.caption || t("postCard.shareText"),
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
        showSuccess(t("postCard.linkCopied"));
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(postUrl);
          showSuccess(t("postCard.linkCopied"));
        } catch (clipboardError) {
          showError(t("postCard.shareError"));
        }
      }
    }
  }, [postId, post.user.username, post.caption, t]);

  const isOwnPost = useMemo(() => {
    if (!currentUser || !post.user) return false;
    const currentUserId = currentUser._id || currentUser.id;
    const postUserId = post.user._id || post.user.id;
    return currentUserId === postUserId;
  }, [currentUser, post.user]);

  const toggleMenu = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);

  const handleCopyLink = useCallback(async () => {
    const postUrl = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(postUrl);
      showSuccess(t("postCard.linkCopied"));
      setShowMenu(false);
    } catch (error) {
      showError(t("postCard.copyLinkError"));
    }
  }, [postId, t]);

  const handleDeletePost = useCallback(async () => {
    try {
      await postService.deletePost(postId);
      showSuccess(t("postCard.postDeleted"));
      if (onPostDeleted) {
        onPostDeleted(postId);
      }
    } catch (error) {
      showError(error.response?.data?.message || t("postCard.deletePostError"));
    }
  }, [postId, onPostDeleted, t]);

  const handleEditPost = useCallback(async () => {
    if (!editCaption.trim() && !editLocation.trim()) {
      showError(t("postCard.editPostRequirement"));
      return;
    }

    try {
      setIsEditing(true);
      await postService.updatePost(postId, {
        caption: editCaption,
        location: editLocation,
      });
      setCaption(editCaption);
      setLocation(editLocation);
      showSuccess(t("postCard.postUpdated"));
      setShowEditModal(false);
      setShowMenu(false);
    } catch (error) {
      showError(error.response?.data?.message || t("postCard.updatePostError"));
    } finally {
      setIsEditing(false);
    }
  }, [postId, editCaption, editLocation, t]);

  const handleLikeComment = useCallback(
    async (commentId) => {
      let previousComments = null;
      let previousReplies = null;

      try {
        setComments((prev) => {
          previousComments = prev;
          return prev.map((comment) =>
            String(comment._id || comment.id) === String(commentId)
              ? {
                  ...comment,
                  isLiked: !comment.isLiked,
                  likesCount: !comment.isLiked
                    ? (comment.likesCount || 0) + 1
                    : Math.max(0, (comment.likesCount || 0) - 1),
                }
              : comment,
          );
        });

        setCommentReplies((prev) => {
          previousReplies = prev;
          const updated = { ...prev };
          Object.keys(updated).forEach((parentId) => {
            updated[parentId] = updated[parentId].map((reply) =>
              String(reply._id || reply.id) === String(commentId)
                ? {
                    ...reply,
                    isLiked: !reply.isLiked,
                    likesCount: !reply.isLiked
                      ? (reply.likesCount || 0) + 1
                      : Math.max(0, (reply.likesCount || 0) - 1),
                  }
                : reply,
            );
          });
          return updated;
        });

        await postService.toggleCommentLike(commentId);
      } catch (error) {
        if (previousComments) {
          setComments(previousComments);
        }
        if (previousReplies) {
          setCommentReplies(previousReplies);
        }
        showError(t("postCard.likeCommentError"));
      }
    },
    [t],
  );

  const handleDeleteComment = useCallback(async () => {
    if (!commentToDelete) return;

    try {
      await postService.deleteComment(commentToDelete);

      // Remove from main comments list
      setComments((prev) =>
        prev.filter((c) => String(c._id || c.id) !== String(commentToDelete)),
      );

      // Remove from nested replies if it exists there
      setCommentReplies((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((parentId) => {
          updated[parentId] = updated[parentId].filter(
            (r) => String(r._id || r.id) !== String(commentToDelete),
          );
        });
        return updated;
      });

      setCommentsCount((prev) => Math.max(0, prev - 1));
      showSuccess(t("postCard.commentDeleted"));
      setCommentToDelete(null);
    } catch (error) {
      showError(
        error.response?.data?.message || t("postCard.deleteCommentError"),
      );
    }
  }, [commentToDelete, t]);

  const handleReplySubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!replyText.trim() || !replyingTo) return;

      try {
        setIsSubmitting(true);
        const response = await postService.addComment(postId, {
          text: replyText,
          parentCommentId: replyingTo,
        });

        if (response.success && response.comment) {
          // Update parent comment's repliesCount in the comments list
          setComments((prev) =>
            prev.map((comment) =>
              String(comment._id || comment.id) === String(replyingTo)
                ? {
                    ...comment,
                    repliesCount: (comment.repliesCount || 0) + 1,
                  }
                : comment,
            ),
          );

          // Add reply to commentReplies if parent is expanded
          if (expandedReplies.has(replyingTo)) {
            setCommentReplies((prev) => ({
              ...prev,
              [replyingTo]: [...(prev[replyingTo] || []), response.comment],
            }));
          }
          setCommentsCount((prev) => prev + 1);
          setReplyText("");
          setReplyingTo(null);
          showSuccess(t("postCard.replyAdded"));
        }
      } catch (error) {
        showError(error.response?.data?.message || t("postCard.addReplyError"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [replyText, replyingTo, postId, expandedReplies, t],
  );

  const handleReplyClick = useCallback((commentId, username = null) => {
    setReplyingTo(commentId);
    if (username) {
      // Auto-mention when replying to a nested reply
      setReplyText(`@${username} `);
    } else {
      setReplyText("");
    }
  }, []);

  const handleToggleReplies = useCallback(
    async (commentId) => {
      const isExpanded = expandedReplies.has(commentId);

      if (isExpanded) {
        // Collapse replies
        setExpandedReplies((prev) => {
          const newSet = new Set(prev);
          newSet.delete(commentId);
          return newSet;
        });
      } else {
        // Expand replies - load if not already loaded
        if (!commentReplies[commentId]) {
          setLoadingReplies((prev) => new Set(prev).add(commentId));
          try {
            const response = await postService.getCommentReplies(commentId);
            if (response.success && response.replies) {
              setCommentReplies((prev) => ({
                ...prev,
                [commentId]: response.replies,
              }));
            }
          } catch (error) {
            showError(t("postCard.loadRepliesError"));
            return;
          } finally {
            setLoadingReplies((prev) => {
              const newSet = new Set(prev);
              newSet.delete(commentId);
              return newSet;
            });
          }
        }

        setExpandedReplies((prev) => new Set(prev).add(commentId));
      }
    },
    [expandedReplies, commentReplies, t],
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleAddComment = useCallback(
    async (e) => {
      e.preventDefault();
      if (!newComment.trim() || isSubmitting) return;

      try {
        setIsSubmitting(true);

        const response = await postService.addComment(postId, newComment);

        setComments((prev) => [...prev, response.comment]);
        setCommentsCount((prev) => prev + 1);
        setNewComment("");
      } catch (error) {
        showError(t("postCard.addCommentError"));
      } finally {
        setIsSubmitting(false);
      }
    },
    [postId, newComment, isSubmitting, t],
  );

  const handleToggleComments = useCallback(async () => {
    if (showComments) {
      // Closing comments
      setShowComments(false);
      setAllCommentsLoaded(false);
    } else {
      // Opening comments - fetch if not loaded
      if (!allCommentsLoaded && !isLoadingComments) {
        try {
          setIsLoadingComments(true);
          setShowComments(true);

          const response = await postService.getComments(postId);

          if (response.success && response.comments) {
            setComments(response.comments);
            setAllCommentsLoaded(true);
          }
        } catch (error) {
          showError(t("postCard.loadCommentsError"));
        } finally {
          setIsLoadingComments(false);
        }
      } else {
        // Already loaded, just show
        setShowComments(true);
      }
    }
  }, [showComments, allCommentsLoaded, isLoadingComments, postId, t]);

  const handleOpenImage = useCallback(() => {
    openPostModal(post);
  }, [post]);

  const fetchAllComments = useCallback(async () => {
    if (allCommentsLoaded || isLoadingComments) {
      setShowComments((prev) => !prev);
      return;
    }
    try {
      setIsLoadingComments(true);
      setShowComments(true);

      const response = await postService.getComments(postId);

      if (response.success && response.comments) {
        setComments(response.comments);
        setAllCommentsLoaded(true);
      }
    } catch (error) {
      showError(t("postCard.loadCommentsError"));
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId, allCommentsLoaded, isLoadingComments, t]);

  return (
    <article className="post-card">
      {/* Post Header */}
      <div className="post-header">
        <div className="post-user">
          <img
            src={userAvatar}
            alt={post.user.username}
            className="post-avatar"
          />
          <span className="post-username">{post.user.username}</span>
        </div>

        <div className="post-menu-container" ref={menuRef}>
          <button
            className="post-menu-btn"
            onClick={toggleMenu}
            aria-label={t("postCard.postOptions")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {showMenu && (
            <div className="post-dropdown-menu">
              {isOwnPost ? (
                <>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setShowEditModal(true);
                      setShowMenu(false);
                    }}
                  >
                    {t("postCard.edit")}
                  </button>
                  <button
                    className="menu-item danger"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setShowMenu(false);
                    }}
                  >
                    {t("postCard.delete")}
                  </button>
                </>
              ) : (
                <button className="menu-item">{t("postCard.report")}</button>
              )}
              <button className="menu-item" onClick={handleCopyLink}>
                {t("postCard.copyLink")}
              </button>
              <button className="menu-item" onClick={() => setShowMenu(false)}>
                {t("postCard.cancel")}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="post-caption">
        <TextWithMentions text={caption} />
      </p>
      {/* Post media */}
      <div
        className="post-media"
        onClick={() => handleOpenImage()}
        onDoubleClick={handleDoubleClick}
      >
        {post.mediaType === "video" && post.video ? (
          <VideoPlayer src={post.video} />
        ) : (
          post.image && <img src={post.image} alt="Post" />
        )}
      </div>

      {/* Post Actions */}
      <div className="post-actions">
        <div className="post-actions-left">
          <button
            className={`action-btn ${isLiked ? "liked" : ""}`}
            onClick={handleLike}
            disabled={isLiking}
            aria-label={isLiked ? t("postCard.unlike") : t("postCard.like")}
            aria-pressed={isLiked}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={isLiked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </button>
          <button
            className="action-btn"
            onClick={handleShare}
            aria-label={t("postCard.share")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        <div className="post-actions-right">
          {commentsCount >= 0 && (
            <button
              className="action-btn comment-count-btn"
              onClick={fetchAllComments}
              disabled={isLoadingComments}
              aria-label={t("postCard.viewAllComments", {
                count: commentsCount,
              })}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="comment-count">{commentsCount}</span>
            </button>
          )}

          <button
            className={`action-btn ${isSaved ? "saved" : ""}`}
            onClick={handleSave}
            aria-label={isSaved ? t("postCard.unsave") : t("postCard.save")}
            aria-pressed={isSaved}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="post-info">
        <p className="post-likes">
          <strong>{t("postCard.likes", { count: likes })}</strong>
        </p>
        <button
          className="view-comments"
          onClick={handleToggleComments}
          disabled={isLoadingComments}
          aria-label={
            showComments
              ? t("postCard.hideComments")
              : commentsCount > 0
                ? t("postCard.viewAllComments", { count: commentsCount })
                : t("postCard.noComments")
          }
        >
          {isLoadingComments
            ? t("postCard.loadingComments")
            : showComments
              ? t("postCard.hideComments")
              : commentsCount > 0
                ? t("postCard.viewAllComments", { count: commentsCount })
                : t("postCard.noComments")}
        </button>

        {showComments && (
          <>
            {commentsCount > 0 && (
              <div className="comments-section">
                {comments
                  .filter((comment) => comment.user)
                  .map((comment) => {
                    const commentId = String(comment._id || comment.id);
                    const commentUserId = comment.user._id || comment.user.id;
                    const currentUserId = currentUser?._id || currentUser?.id;
                    const isOwnComment = currentUserId === commentUserId;

                    return (
                      <div key={commentId}>
                        <div className="comment-item">
                          <img
                            src={getUserAvatar(comment.user)}
                            alt={comment.user.username || t("postCard.userAlt")}
                            className="comment-avatar"
                          />
                          <div className="comment-content">
                            <p className="comment-text">
                              <strong>
                                {comment.user.username ||
                                  t("postCard.unknownUser")}
                              </strong>{" "}
                              <TextWithMentions text={comment.text} />
                            </p>
                            <div className="comment-meta">
                              <span className="comment-timestamp">
                                {formatTimestamp(
                                  comment.createdAt || comment.timestamp,
                                )}
                              </span>
                              {comment.likesCount > 0 && (
                                <span className="comment-likes">
                                  {comment.likesCount}{" "}
                                  {t("postCard.commentLikes", {
                                    count: comment.likesCount,
                                  })}
                                </span>
                              )}
                              <button
                                className="comment-reply-btn"
                                onClick={() => handleReplyClick(commentId)}
                              >
                                {t("postCard.reply")}
                              </button>
                              {isOwnComment && (
                                <button
                                  className="comment-delete-btn"
                                  onClick={() => setCommentToDelete(commentId)}
                                >
                                  {t("postCard.delete")}
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            className={`comment-like-btn ${
                              comment.isLiked ? "liked" : ""
                            }`}
                            onClick={() => handleLikeComment(commentId)}
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill={comment.isLiked ? "currentColor" : "none"}
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                          </button>
                        </div>

                        {replyingTo === commentId && (
                          <form
                            onSubmit={handleReplySubmit}
                            className="reply-form"
                          >
                            <input
                              type="text"
                              placeholder={t("postCard.replyTo", {
                                username: comment.user.username,
                              })}
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={!replyText.trim() || isSubmitting}
                            >
                              {isSubmitting
                                ? t("postCard.posting")
                                : t("postCard.post")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              {t("postCard.cancel")}
                            </button>
                          </form>
                        )}

                        {/* View Replies Button */}
                        {comment.repliesCount > 0 && (
                          <button
                            className="view-replies-btn"
                            onClick={() => handleToggleReplies(commentId)}
                            disabled={loadingReplies.has(commentId)}
                          >
                            {loadingReplies.has(commentId)
                              ? t("postCard.loadingReplies")
                              : expandedReplies.has(commentId)
                                ? t("postCard.hideReplies", {
                                    count: comment.repliesCount,
                                  })
                                : t("postCard.viewReplies", {
                                    count: comment.repliesCount,
                                  })}
                          </button>
                        )}

                        {/* Nested Replies */}
                        {expandedReplies.has(commentId) &&
                          commentReplies[commentId] && (
                            <div className="nested-replies">
                              {commentReplies[commentId].map((reply) => {
                                const replyId = String(reply._id || reply.id);
                                const replyUserId =
                                  reply.user._id || reply.user.id;
                                const isOwnReply =
                                  currentUserId === replyUserId;

                                return (
                                  <div
                                    key={replyId}
                                    className="comment-item reply-item"
                                  >
                                    <img
                                      src={getUserAvatar(reply.user)}
                                      alt={
                                        reply.user.username ||
                                        t("postCard.userAlt")
                                      }
                                      className="comment-avatar"
                                    />
                                    <div className="comment-content">
                                      <p className="comment-text">
                                        <strong>
                                          {reply.user.username ||
                                            t("postCard.unknownUser")}
                                        </strong>{" "}
                                        <TextWithMentions text={reply.text} />
                                      </p>
                                      <div className="comment-meta">
                                        <span className="comment-timestamp">
                                          {formatTimestamp(
                                            reply.createdAt || reply.timestamp,
                                          )}
                                        </span>
                                        {reply.likesCount > 0 && (
                                          <span className="comment-likes">
                                            {reply.likesCount}{" "}
                                            {t("postCard.commentLikes", {
                                              count: reply.likesCount,
                                            })}
                                          </span>
                                        )}
                                        <button
                                          className="comment-reply-btn"
                                          onClick={() =>
                                            handleReplyClick(
                                              commentId,
                                              reply.user.username,
                                            )
                                          }
                                        >
                                          {t("postCard.reply")}
                                        </button>
                                        {isOwnReply && (
                                          <button
                                            className="comment-delete-btn"
                                            onClick={() =>
                                              setCommentToDelete(replyId)
                                            }
                                          >
                                            {t("postCard.delete")}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      className={`comment-like-btn ${
                                        reply.isLiked ? "liked" : ""
                                      }`}
                                      onClick={() => handleLikeComment(replyId)}
                                    >
                                      <svg
                                        width="12"
                                        height="12"
                                        viewBox="0 0 24 24"
                                        fill={
                                          reply.isLiked
                                            ? "currentColor"
                                            : "none"
                                        }
                                        stroke="currentColor"
                                        strokeWidth="2"
                                      >
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    );
                  })}
              </div>
            )}

            <p className="post-timestamp">{postTimestamp}</p>
          </>
        )}
      </div>
      {/* Add Comment */}
      <form
        onSubmit={handleAddComment}
        className="post-add-comment"
        aria-label={t("postCard.addComment")}
      >
        <input
          type="text"
          placeholder={t("postCard.addCommentPlaceholder")}
          className="comment-input"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          aria-label={t("postCard.commentText")}
        />
        <button
          type="submit"
          className="comment-btn"
          disabled={!newComment.trim()}
          aria-label={t("postCard.postComment")}
        >
          {t("postCard.post")}
        </button>
      </form>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePost}
        title={t("postCard.deletePostTitle")}
        message={t("postCard.deletePostMessage")}
        confirmText={t("postCard.delete")}
        cancelText={t("postCard.cancel")}
        isDangerous={true}
      />

      <ConfirmDialog
        isOpen={!!commentToDelete}
        onClose={() => setCommentToDelete(null)}
        onConfirm={handleDeleteComment}
        title={t("postCard.deleteCommentTitle")}
        message={t("postCard.deleteCommentMessage")}
        confirmText={t("postCard.delete")}
        cancelText={t("postCard.cancel")}
        isDangerous={true}
      />

      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="edit-modal-header">
              <h3>{t("postCard.editPostTitle")}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <div className="edit-modal-body">
              <div className="form-group">
                <label htmlFor="edit-caption">
                  {t("postCard.captionLabel")}
                </label>
                <textarea
                  id="edit-caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder={t("postCard.captionPlaceholder")}
                  rows="4"
                  maxLength="2200"
                />
                <span className="char-count">{editCaption.length}/2200</span>
              </div>
              <div className="form-group">
                <label htmlFor="edit-location">
                  {t("postCard.locationLabel")}
                </label>
                <input
                  id="edit-location"
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder={t("postCard.locationPlaceholder")}
                  maxLength="100"
                />
              </div>
            </div>
            <div className="edit-modal-footer">
              <button
                className="btn-cancel"
                onClick={() => setShowEditModal(false)}
              >
                {t("postCard.cancel")}
              </button>
              <button
                className="btn-save"
                onClick={handleEditPost}
                disabled={isEditing}
              >
                {isEditing ? t("postCard.saving") : t("postCard.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedPost && (
        <PostModal post={selectedPost} onClose={closePostModal} />
      )}
    </article>
  );
}

export default memo(PostCard);
