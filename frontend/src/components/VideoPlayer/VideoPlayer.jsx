import React, { useState, useCallback, useRef } from "react";
import "./VideoPlayer.css";

function VideoPlayer({ src, className = "" }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);

  const handleVideoClick = useCallback((e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const handleVideoPlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handleVideoPause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div className={`video-player ${className}`}>
      <video
        ref={videoRef}
        src={src}
        controls
        className="video-element"
        preload="metadata"
        onClick={handleVideoClick}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
      />
      {!isPlaying && (
        <div className="video-play-overlay" onClick={handleVideoClick}>
          <div className="play-button">
            <svg
              width="72"
              height="72"
              viewBox="0 0 24 24"
              fill="white"
            >
              <circle cx="12" cy="12" r="11" opacity="0.9" />
              <path d="M10 8.5v7l5.5-3.5-5.5-3.5z" fill="#000" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
