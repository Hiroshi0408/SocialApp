import React from "react";
import { getUserAvatar } from "../../utils";

function StoryCircle({ user, hasUnviewed, storiesCount, onClick }) {
  return (
    <div className="story-circle" onClick={onClick}>
      <div className={`story-avatar-wrapper ${hasUnviewed ? "unviewed" : "viewed"}`}>
        <img
          src={getUserAvatar(user)}
          alt={user.username}
          className="story-avatar"
        />
        {storiesCount > 1 && (
          <span className="story-count">{storiesCount}</span>
        )}
      </div>
      <span className="story-username">{user.username}</span>
    </div>
  );
}

export default StoryCircle;
