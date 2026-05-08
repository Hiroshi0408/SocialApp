import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import MediaUpload from "../MediaUpload/MediaUpload";
import postService from "../../api/postService";
import { useWeb3 } from "../../contexts/Web3Context";
import { useAuth } from "../../contexts/AuthContext";
import { getUserAvatar } from "../../utils";
import { POST_LIMITS } from "../../constants";
import { showError, showSuccess } from "../../utils/toast";
import "./CreatePostModal.css";

// 1-step layout: media + caption + location cùng trên 1 panel.
// Cho phép submit khi có ít nhất caption HOẶC media (text-only post được).
function CreatePostModal({ isOpen, onClose, onPostCreated, groupId = null }) {
  const { t } = useTranslation();
  const { walletAddress } = useWeb3();
  const { user } = useAuth();
  const [media, setMedia] = useState([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [registerOnChain, setRegisterOnChain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ContentRegistry hiện chỉ hash 1 media (v2). Multi-image → ẩn toggle on-chain.
  // Group post cũng không stamp on-chain (private content).
  const canRegisterOnChain =
    walletAddress && !groupId && media.length === 1;

  const canSubmit =
    !isSubmitting && (media.length > 0 || caption.trim().length > 0);

  const handleClose = () => {
    setMedia([]);
    setCaption("");
    setLocation("");
    setRegisterOnChain(false);
    setError("");
    setIsSubmitting(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError("");

    try {
      const postData = {
        media,
        caption: caption.trim(),
        location: location.trim() || undefined,
        registerOnChain: canRegisterOnChain ? registerOnChain : false,
        ...(groupId ? { groupId } : {}),
      };

      const response = await postService.createPost(postData);

      if (response.success) {
        if (
          response.post?.onChain?.contentHash &&
          !response.post?.onChain?.registered
        ) {
          showSuccess(t("createPost.stampingToast"));
        }
        handleClose();
        if (onPostCreated) onPostCreated(response.post);
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

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="create-post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("createPost.createNewPost")}</h2>
          <button
            className="close-btn"
            onClick={handleClose}
            aria-label={t("common.close", "Đóng")}
          >
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
          <div className="create-grid">
            <div className="media-column">
              <MediaUpload media={media} onChange={setMedia} />
            </div>

            <div className="form-column">
              <div className="user-info">
                {user?.avatar !== undefined && (
                  <img
                    src={getUserAvatar(user)}
                    alt={user?.username || ""}
                    className="user-avatar"
                  />
                )}
                <span className="username">{user?.username}</span>
              </div>

              <textarea
                className="caption-input"
                placeholder={t("createPost.captionPlaceholder")}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={POST_LIMITS.CAPTION_MAX_LENGTH}
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

              {canRegisterOnChain && (
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

              {walletAddress && !groupId && media.length > 1 && (
                <p className="onchain-note">
                  {t("createPost.onChainMultiMediaNote")}
                </p>
              )}

              {error && <div className="error-message">{error}</div>}

              <button
                className="share-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting
                  ? t("createPost.sharingButton")
                  : t("createPost.shareButton")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreatePostModal;
