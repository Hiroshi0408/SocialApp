import React, { useState, useCallback } from "react";
import VideoPlayer from "../VideoPlayer/VideoPlayer";
import "./MediaCarousel.css";

// Carousel cho post media[]. Single-media → render thẳng không hiện nav.
// Helper getPostMedia() ở dưới chuyển legacy { image, video, mediaType } → media[]
// để code gọi không phải tự handle 2 case.
function MediaCarousel({ media, onClick, onDoubleClick }) {
  const [index, setIndex] = useState(0);
  const items = Array.isArray(media) ? media : [];

  const goPrev = useCallback((e) => {
    e.stopPropagation();
    setIndex((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(
    (e) => {
      e.stopPropagation();
      setIndex((i) => Math.min(items.length - 1, i + 1));
    },
    [items.length],
  );

  if (items.length === 0) return null;

  const current = items[index];
  const showNav = items.length > 1;

  return (
    <div
      className="media-carousel"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="carousel-stage">
        {current.type === "video" ? (
          <VideoPlayer src={current.url} />
        ) : (
          <img src={current.url} alt="Post" />
        )}
      </div>

      {showNav && index > 0 && (
        <button
          type="button"
          className="carousel-nav carousel-nav-prev"
          onClick={goPrev}
          aria-label="Previous"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {showNav && index < items.length - 1 && (
        <button
          type="button"
          className="carousel-nav carousel-nav-next"
          onClick={goNext}
          aria-label="Next"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {showNav && (
        <div className="carousel-dots" onClick={(e) => e.stopPropagation()}>
          {items.map((_, i) => (
            <span
              key={i}
              className={`carousel-dot ${i === index ? "active" : ""}`}
            />
          ))}
        </div>
      )}

      {showNav && (
        <span className="carousel-counter">
          {index + 1}/{items.length}
        </span>
      )}
    </div>
  );
}

// Lấy media[] từ post object — ưu tiên field media (post mới),
// fallback sang legacy image/video (post cũ chưa migrate).
export function getPostMedia(post) {
  if (Array.isArray(post?.media) && post.media.length > 0) return post.media;
  if (post?.video) {
    return [
      { type: "video", url: post.video, duration: post.videoDuration || 0 },
    ];
  }
  if (post?.image) {
    return [{ type: "image", url: post.image, duration: 0 }];
  }
  return [];
}

export default MediaCarousel;
