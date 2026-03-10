import React, { useEffect, useState, useCallback } from "react";
import { getUserAvatar, formatTimestamp, getId } from "../../utils";
import VideoPlayer from "../VideoPlayer/VideoPlayer";
import TextWithMentions from "../TextWithMentions/TextWithMentions";
import postService from "../../api/postService";
import "./PostModal.css";

function PostModal({ post, onClose }) {
  const [comments, setComments] = useState(post.commentsList || []);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [allCommentsLoaded, setAllCommentsLoaded] = useState(
    post.commentsLoaded || !!post.commentsList?.length,
  );
  const [expandedReplies, setExpandedReplies] = useState(new Set());
  const [commentReplies, setCommentReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState(new Set());

  const postId = getId(post);

  const fetchComments = useCallback(async () => {
    if (allCommentsLoaded || isLoadingComments) return;

    try {
      setIsLoadingComments(true);
      const response = await postService.getComments(postId);
      if (response.success && response.comments) {
        setComments(response.comments || []);
      } else if (response.data) {
        setComments(response.data || []);
      }
      setAllCommentsLoaded(true);
    } catch (error) {
      console.error("Error fetching comments:", error);
      setAllCommentsLoaded(true);
    } finally {
      setIsLoadingComments(false);
    }
  }, [postId, allCommentsLoaded, isLoadingComments]);

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
            console.error("Error loading replies:", error);
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
    [expandedReplies, commentReplies],
  );

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  useEffect(() => {
    if (!allCommentsLoaded && !isLoadingComments) {
      fetchComments();
    }
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className="modal-close" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7A.996.996 0 1 0 5.7 7.11L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.88a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z" />
          </svg>
        </button>

        <div className="modal-body">
          {/* Left - Image/Video */}
          <div className="modal-image-container">
            {post.mediaType === "video" && post.video ? (
              <VideoPlayer src={post.video} className="modal-video" />
            ) : (
              <img src={post.image} alt="Post" className="modal-image" />
            )}
          </div>

          {/* Right - Details */}
          <div className="modal-details">
            {/* Header */}
            <div className="modal-header">
              <div className="modal-user">
                <img
                  src={getUserAvatar(post.user)}
                  alt={post.user?.username}
                  className="modal-avatar"
                />
                <span className="modal-username">{post.user?.username}</span>
              </div>
              <button className="modal-menu-btn">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </div>

            {/* Comments/Caption Area */}
            <div className="modal-comments">
              {post.caption && (
                <p className="modal-caption">
                  <strong>{post.user?.username}</strong>{" "}
                  <TextWithMentions text={post.caption} />
                </p>
              )}

              {/* Comments List */}
              <div className="modal-comments-section">
                {isLoadingComments ? (
                  <p className="modal-loading-text">Loading comments...</p>
                ) : comments.length > 0 ? (
                  <div className="modal-comments-list">
                    {comments.map((comment) => {
                      const commentId = String(comment._id || comment.id);
                      return (
                        <div key={commentId}>
                          <div className="modal-comment-item">
                            <img
                              src={getUserAvatar(comment.user)}
                              alt={comment.user?.username}
                              className="modal-comment-avatar"
                            />
                            <div className="modal-comment-content">
                              <p className="modal-comment-text">
                                <strong>{comment.user?.username}</strong>{" "}
                                <TextWithMentions text={comment.text} />
                              </p>
                              <div className="modal-comment-meta">
                                <span className="modal-comment-timestamp">
                                  {formatTimestamp(
                                    comment.createdAt || comment.timestamp,
                                  )}
                                </span>
                                {comment.likesCount > 0 && (
                                  <span className="modal-comment-likes">
                                    {comment.likesCount} likes
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* View Replies Button */}
                          {comment.repliesCount > 0 && (
                            <button
                              className="modal-view-replies-btn"
                              onClick={() => handleToggleReplies(commentId)}
                              disabled={loadingReplies.has(commentId)}
                            >
                              {loadingReplies.has(commentId)
                                ? "Loading replies..."
                                : expandedReplies.has(commentId)
                                  ? `Hide replies (${comment.repliesCount})`
                                  : `View replies (${comment.repliesCount})`}
                            </button>
                          )}

                          {/* Nested Replies */}
                          {expandedReplies.has(commentId) &&
                            commentReplies[commentId] && (
                              <div className="modal-nested-replies">
                                {commentReplies[commentId].map((reply) => {
                                  const replyId = String(reply._id || reply.id);
                                  return (
                                    <div
                                      key={replyId}
                                      className="modal-comment-item modal-reply-item"
                                    >
                                      <img
                                        src={getUserAvatar(reply.user)}
                                        alt={reply.user?.username}
                                        className="modal-comment-avatar"
                                      />
                                      <div className="modal-comment-content">
                                        <p className="modal-comment-text">
                                          <strong>
                                            {reply.user?.username}
                                          </strong>{" "}
                                          <TextWithMentions text={reply.text} />
                                        </p>
                                        <div className="modal-comment-meta">
                                          <span className="modal-comment-timestamp">
                                            {formatTimestamp(
                                              reply.createdAt ||
                                                reply.timestamp,
                                            )}
                                          </span>
                                          {reply.likesCount > 0 && (
                                            <span className="modal-comment-likes">
                                              {reply.likesCount} likes
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="modal-no-comments">No comments yet</p>
                )}
              </div>

              {/* Likes and Timestamp */}
              <div className="modal-post-info">
                <div className="modal-likes">
                  <strong>{post.likes} likes</strong>
                </div>
                <div className="modal-timestamp">
                  {formatTimestamp(post.createdAt || post.timestamp)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostModal;
