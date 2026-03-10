import React from "react";
import "./Loading.css";

function Loading({ fullScreen = false, text = "Loading..." }) {
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className="spinner"></div>
        <p>{text}</p>
      </div>
    );
  }

  return (
    <div className="loading-inline">
      <div className="spinner"></div>
      <span>{text}</span>
    </div>
  );
}

export default Loading;
