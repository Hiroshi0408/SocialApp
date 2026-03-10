import React from "react";
import { Link } from "react-router-dom";
import "./TextWithMentions.css";

function TextWithMentions({ text }) {
  if (!text) return null;

  // Parse text for mentions (@username) and hashtags (#tag)
  const parseText = (text) => {
    const parts = [];
    const regex = /(@[a-zA-Z0-9._]+)|(#[\w]+)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }

      // Add mention or hashtag
      if (match[1]) {
        // @mention
        const username = match[1].slice(1).toLowerCase();
        parts.push({
          type: "mention",
          content: match[1],
          username,
        });
      } else if (match[2]) {
        // #hashtag
        parts.push({
          type: "hashtag",
          content: match[2],
          tag: match[2].toLowerCase(),
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex),
      });
    }

    return parts;
  };

  const parts = parseText(text);

  return (
    <span className="text-with-mentions">
      {parts.map((part, index) => {
        if (part.type === "mention") {
          return (
            <Link
              key={index}
              to={`/profile/${part.username}`}
              className="mention-link"
              onClick={(e) => e.stopPropagation()}
            >
              {part.content}
            </Link>
          );
        } else if (part.type === "hashtag") {
          return (
            <span key={index} className="hashtag-link">
              {part.content}
            </span>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}

export default TextWithMentions;
