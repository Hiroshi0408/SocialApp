import React, { useState, useEffect, useRef } from "react";
import { getUserAvatar, formatTimestamp, showSuccess, showError } from "../../utils";
import { useAuth } from "../../contexts/AuthContext";
import storyService from "../../api/storyService";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./Stories.css";

function StoryViewer({ storyGroups, initialUserIndex, onClose, onUpdate, onStoryDeleted }) {
  const { user: currentUser } = useAuth();
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const progressInterval = useRef(null);
  const STORY_DURATION = 5000;

  const currentGroup = storyGroups[currentUserIndex];
  const currentStory = currentGroup?.stories[currentStoryIndex];

  useEffect(() => {
    if (progress >= 100) {
      goToNextStory();
    }
  }, [progress]);

  useEffect(() => {
    if (currentStory && !currentStory.hasViewed) {
      markAsViewed(currentStory._id);
    }
  }, [currentStory?._id]);

  useEffect(() => {
    startProgress();
    return () => clearInterval(progressInterval.current);
  }, [currentUserIndex, currentStoryIndex, isPaused]);

  const markAsViewed = async (storyId) => {
    try {
      const response = await storyService.viewStory(storyId);
      if (onUpdate && response.success) {
        const updates = { hasViewed: true };
        if (typeof response.viewsCount === 'number') {
          updates.viewsCount = response.viewsCount;
        }
        onUpdate(storyId, updates);
      }
    } catch (error) {
      console.error("Failed to mark story as viewed:", error);
    }
  };

  const fetchViewers = async () => {
    if (!currentStory) return;

    try {
      setLoadingViewers(true);
      const response = await storyService.getStoryViewers(currentStory._id);
      if (response.success) {
        setViewers(response.viewers || []);
      }
    } catch (error) {
      showError("Failed to load viewers");
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleShowViewers = () => {
    setShowViewers(true);
    setIsPaused(true);
    fetchViewers();
  };

  const handleCloseViewers = () => {
    setShowViewers(false);
    setIsPaused(false);
  };

  const startProgress = () => {
    clearInterval(progressInterval.current);
    setProgress(0);

    if (isPaused) return;

    const increment = 100 / (STORY_DURATION / 50);
    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current);
          return 100;
        }
        return prev + increment;
      });
    }, 50);
  };

  const goToNextStory = () => {
    if (currentStoryIndex < currentGroup.stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentUserIndex < storyGroups.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex(currentUserIndex - 1);
      setCurrentStoryIndex(storyGroups[currentUserIndex - 1].stories.length - 1);
    }
  };

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const halfWidth = rect.width / 2;

    if (clickX < halfWidth) {
      goToPreviousStory();
    } else {
      goToNextStory();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      if (showViewers) {
        handleCloseViewers();
      } else {
        onClose();
      }
    } else if (e.key === "ArrowRight") {
      goToNextStory();
    } else if (e.key === "ArrowLeft") {
      goToPreviousStory();
    } else if (e.key === " ") {
      setIsPaused(!isPaused);
    }
  };

  const handleDeleteStory = async () => {
    try {
      await storyService.deleteStory(currentStory._id);
      showSuccess("Story deleted successfully");

      if (onStoryDeleted) {
        onStoryDeleted(currentStory._id);
      }

      if (currentGroup.stories.length === 1) {
        onClose();
      } else {
        goToNextStory();
      }
    } catch (error) {
      showError(error.response?.data?.message || "Failed to delete story");
    }
  };

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentUserIndex, currentStoryIndex, isPaused, showViewers]);

  if (!currentStory) return null;

  const isOwnStory =
    currentUser &&
    currentGroup?.user &&
    currentUser?._id?.toString() === currentGroup?.user?._id?.toString();

  return (
    <div className="story-viewer-overlay">
      <div className="story-viewer">
        <button className="story-close-btn" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>

        <div className="story-progress-bar">
          {currentGroup.stories.map((_, index) => (
            <div key={index} className="progress-segment">
              <div
                className="progress-fill"
                style={{
                  width:
                    index < currentStoryIndex
                      ? "100%"
                      : index === currentStoryIndex
                      ? `${progress}%`
                      : "0%",
                }}
              />
            </div>
          ))}
        </div>

        <div className="story-header">
          <img
            src={getUserAvatar(currentGroup.user)}
            alt={currentGroup.user.username}
            className="story-user-avatar"
          />
          <div className="story-user-info">
            <span className="story-username">{currentGroup.user.username}</span>
            <span className="story-time">{currentStory.timestamp}</span>
          </div>
          <div className="story-header-actions">
            {isOwnStory && currentStory.viewsCount > 0 && (
              <button
                className="story-viewers-btn"
                onClick={handleShowViewers}
                title="View viewers"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{currentStory.viewsCount}</span>
              </button>
            )}
            {isOwnStory && (
              <button
                className="story-delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete story"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div
          className="story-content"
          onClick={handleClick}
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <img src={currentStory.image} alt="Story" className="story-image" />
          {currentStory.caption && (
            <div className="story-caption">{currentStory.caption}</div>
          )}
        </div>

        <div className="story-navigation">
          {currentUserIndex > 0 && (
            <button
              className="nav-btn prev"
              onClick={() => {
                setCurrentUserIndex(currentUserIndex - 1);
                setCurrentStoryIndex(0);
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
              </svg>
            </button>
          )}
          {currentUserIndex < storyGroups.length - 1 && (
            <button
              className="nav-btn next"
              onClick={() => {
                setCurrentUserIndex(currentUserIndex + 1);
                setCurrentStoryIndex(0);
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showViewers && (
        <div className="story-viewers-modal" onClick={handleCloseViewers}>
          <div className="viewers-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="viewers-modal-header">
              <h3>Viewers</h3>
              <button className="viewers-close-btn" onClick={handleCloseViewers}>
                ×
              </button>
            </div>
            <div className="viewers-list">
              {loadingViewers ? (
                <div className="viewers-loading">Loading...</div>
              ) : viewers.length > 0 ? (
                viewers.map((viewer, index) => (
                  <div key={index} className="viewer-item">
                    <img
                      src={getUserAvatar(viewer.user)}
                      alt={viewer.user.username}
                      className="viewer-avatar"
                    />
                    <div className="viewer-info">
                      <span className="viewer-username">{viewer.user.username}</span>
                      <span className="viewer-fullname">{viewer.user.fullName}</span>
                    </div>
                    <span className="viewer-time">{formatTimestamp(viewer.viewedAt)}</span>
                  </div>
                ))
              ) : (
                <div className="viewers-empty">No viewers yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteStory}
        title="Delete Story"
        message="Are you sure you want to delete this story? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
      />
    </div>
  );
}

export default StoryViewer;
