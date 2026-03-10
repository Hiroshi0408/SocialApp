import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import storyService from "../../api/storyService";
import { showError } from "../../utils";
import StoryCircle from "./StoryCircle";
import StoryViewer from "./StoryViewer";
import CreateStory from "./CreateStory";
import "./Stories.css";

function StoriesBar() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [storyGroups, setStoryGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showViewer, setShowViewer] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchStories();
  }, []);

  const handleStoryUpdate = (storyId, updates) => {
    setStoryGroups((groups) =>
      groups.map((group) => {
        const storyExists = group.stories.some((s) => s._id === storyId);
        if (!storyExists) return group;

        const updatedStories = group.stories.map((story) =>
          story._id === storyId ? { ...story, ...updates } : story
        );

        return {
          ...group,
          stories: updatedStories,
          hasUnviewed: updatedStories.some((s) => !s.hasViewed),
        };
      })
    );
  };

  const fetchStories = async () => {
    try {
      setLoading(true);
      const response = await storyService.getAllStories();
      if (response.success) {
        setStoryGroups(response.storyGroups);
      }
    } catch (error) {
      showError(t("stories.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleStoryClick = (index) => {
    setSelectedUserIndex(index);
    setShowViewer(true);
  };

  const handleStoryCreated = (newStory) => {
    const userGroupIndex = storyGroups.findIndex(
      (group) => group.user._id === user._id
    );

    if (userGroupIndex >= 0) {
      const updatedGroups = [...storyGroups];
      updatedGroups[userGroupIndex].stories.unshift(newStory);
      updatedGroups[userGroupIndex].hasUnviewed = true;
      setStoryGroups(updatedGroups);
    } else {
      const newGroup = {
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
        },
        stories: [newStory],
        hasUnviewed: true,
      };
      setStoryGroups([newGroup, ...storyGroups]);
    }
  };

  const handleStoryDeleted = (deletedStoryId) => {
    setStoryGroups(prevGroups => 
      prevGroups.map(group => ({
        ...group,
        stories: group.stories.filter(story => story._id !== deletedStoryId),
      })).filter(group => group.stories.length > 0)
    );
  };

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (loading) {
    return (
      <div className="stories-bar">
        <div className="stories-loading">
          <div className="story-skeleton"></div>
          <div className="story-skeleton"></div>
          <div className="story-skeleton"></div>
          <div className="story-skeleton"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="stories-bar">
        <div className="stories-container">
          <button
            className="stories-scroll-btn left"
            onClick={() => handleScroll("left")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          <div className="stories-list" ref={scrollRef}>
            <div className="add-story" onClick={() => setShowCreateStory(true)}>
              <div className="add-story-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
                </svg>
              </div>
              <span>{t("stories.yourStory")}</span>
            </div>

            {storyGroups.map((group, index) => (
              <StoryCircle
                key={group.user._id}
                user={group.user}
                hasUnviewed={group.hasUnviewed}
                storiesCount={group.stories.length}
                onClick={() => handleStoryClick(index)}
              />
            ))}
          </div>

          <button
            className="stories-scroll-btn right"
            onClick={() => handleScroll("right")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
            </svg>
          </button>
        </div>
      </div>

      {showViewer && storyGroups.length > 0 && (
        <StoryViewer
          storyGroups={storyGroups}
          initialUserIndex={selectedUserIndex}
          onClose={() => setShowViewer(false)}
          onUpdate={handleStoryUpdate}
          onStoryDeleted={handleStoryDeleted}
        />
      )}

      {showCreateStory && (
        <CreateStory
          onClose={() => setShowCreateStory(false)}
          onStoryCreated={handleStoryCreated}
        />
      )}
    </>
  );
}

export default StoriesBar;
