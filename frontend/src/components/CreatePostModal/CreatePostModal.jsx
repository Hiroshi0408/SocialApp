import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import MediaUpload from "../MediaUpload/MediaUpload";
import postService from "../../api/postService";
import { useWeb3 } from "../../contexts/Web3Context";
import { getUserAvatar } from "../../utils";
import { POST_LIMITS } from "../../constants";
import { showError } from "../../utils/toast";
import "./CreatePostModal.css";

function CreatePostModal({ isOpen, onClose, onPostCreated, groupId = null }) {
  const { t } = useTranslation();
  const { walletAddress } = useWeb3();
  const [step, setStep] = useState(1);
  const [mediaData, setMediaData] = useState(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [registerOnChain, setRegisterOnChain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  let user = {};
  try {
    const stored = localStorage.getItem("user");
    if (stored) user = JSON.parse(stored);
  } catch (e) {
    console.error("Failed to parse user from localStorage", e);
  }

  const handleMediaUpload = (data) => {
    if (data) {
      setMediaData(data);
      setStep(2);
    } else {
      setMediaData(null);
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setCaption("");
      setLocation("");
      setRegisterOnChain(false);
    }
  };

  const handleSubmit = async () => {
    if (!mediaData) {
      setError(t("createPost.uploadMediaRequired"));
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const postData = {
        caption: caption.trim(),
        location: location.trim() || undefined,
        mediaType: mediaData.type,
        // Post trong group riêng thì không register on-chain (ContentRegistry
        // dùng để prove authorship công khai, không hợp với bài private)
        registerOnChain: walletAddress && !groupId ? registerOnChain : false,
        ...(groupId ? { groupId } : {}),
      };

      if (mediaData.type === "video") {
        postData.video = mediaData.url;
        postData.videoDuration = mediaData.duration || 0;
      } else {
        postData.image = mediaData.url;
      }
      const response = await postService.createPost(postData);

      if (response.success) {
        handleClose();
        if (onPostCreated) {
          onPostCreated(response.post);
        }
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || t("createPost.createPostFailed");
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setMediaData(null);
    setCaption("");
    setLocation("");
    setRegisterOnChain(false);
    setError("");
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="create-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {step === 2 && (
            <button className="back-btn" onClick={handleBack}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h2>
            {step === 1
              ? t("createPost.createNewPost")
              : t("createPost.addDetails")}
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          {step === 1 && (
            <div className="upload-step">
              <MediaUpload onUpload={handleMediaUpload} />
            </div>
          )}

          {step === 2 && mediaData && (
            <div className="details-step">
              <div className="post-preview">
                {mediaData.type === "video" ? (
                  <video src={mediaData.url} />
                ) : (
                  <img
                    src={mediaData.url}
                    alt={t("createPost.postPreviewAlt")}
                  />
                )}
              </div>

              <div className="post-form">
                <div className="user-info">
                  <img
                    src={getUserAvatar(user)}
                    alt={user.username}
                    className="user-avatar"
                  />
                  <span className="username">{user.username}</span>
                </div>

                <textarea
                  className="caption-input"
                  placeholder={t("createPost.captionPlaceholder")}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={POST_LIMITS.CAPTION_MAX_LENGTH}
                  autoFocus
                />

                <div className="caption-counter">
                  {caption.length}/{POST_LIMITS.CAPTION_MAX_LENGTH}
                </div>

                <div className="location-section">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <input
                    type="text"
                    className="location-input"
                    placeholder={t("createPost.locationPlaceholder")}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={POST_LIMITS.LOCATION_MAX_LENGTH}
                  />
                </div>

                {walletAddress && !groupId && (
                  <label
                    className="onchain-toggle"
                    title={t("createPost.onChainTooltip")}
                  >
                    <input
                      type="checkbox"
                      checked={registerOnChain}
                      onChange={(e) => setRegisterOnChain(e.target.checked)}
                    />
                    <span className="onchain-toggle-icon">🔗</span>
                    <span className="onchain-toggle-label">
                      {t("createPost.registerOnChain")}
                    </span>
                  </label>
                )}

                {error && <div className="error-message">{error}</div>}

                <button
                  className="share-btn"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !mediaData}
                >
                  {isSubmitting
                    ? t("createPost.sharingButton")
                    : t("createPost.shareButton")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreatePostModal;
