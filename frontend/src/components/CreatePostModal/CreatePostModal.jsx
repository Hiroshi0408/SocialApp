import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import MediaUpload from "../MediaUpload/MediaUpload";
import postService from "../../api/postService";
import { useAuth } from "../../contexts/AuthContext";
import { getUserAvatar } from "../../utils";
import { POST_LIMITS } from "../../constants";
import { showError, showSuccess } from "../../utils/toast";
import "./CreatePostModal.css";

// 1-step layout: media + caption + location cùng trên 1 panel.
// Cho phép submit khi có ít nhất caption HOẶC media (text-only post được).
function CreatePostModal({ isOpen, onClose, onPostCreated, groupId = null }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [media, setMedia] = useState([]);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [registerOnChain, setRegisterOnChain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasContent = media.length > 0 || caption.trim().length > 0;
  // ContentRegistry hash v2 hỗ trợ text-only hoặc 1 media. Multi-image chưa stamp.
  // BE relay trả gas, nên UI không cần bắt user connect ví để bật lựa chọn này.
  const canRegisterOnChain = !groupId && media.length <= 1 && hasContent;
  const onChainUnavailableReason = useMemo(() => {
    if (groupId) return t("createPost.onChainGroupNote");
    if (media.length > 1) return t("createPost.onChainMultiMediaNote");
    if (!hasContent) return t("createPost.onChainContentNote");
    return "";
  }, [groupId, hasContent, media.length, t]);

  const canSubmit = !isSubmitting && hasContent;

  useEffect(() => {
    if (!canRegisterOnChain && registerOnChain) {
      setRegisterOnChain(false);
    }
  }, [canRegisterOnChain, registerOnChain]);

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

              <div
                className={`onchain-option ${
                  registerOnChain ? "selected" : ""
                } ${!canRegisterOnChain ? "disabled" : ""}`}
                title={t("createPost.onChainTooltip")}
              >
                <label className="onchain-toggle">
                  <input
                    type="checkbox"
                    checked={registerOnChain}
                    disabled={!canRegisterOnChain}
                    onChange={(e) => setRegisterOnChain(e.target.checked)}
                  />
                  <span className="onchain-toggle-box" aria-hidden="true">
                    {registerOnChain ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                      >
                        <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.9 5.03" />
                        <path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07l1.22-1.22" />
                      </svg>
                    )}
                  </span>
                  <span className="onchain-toggle-copy">
                    <span className="onchain-toggle-label">
                      {t("createPost.registerOnChain")}
                    </span>
                    <span className="onchain-toggle-subtitle">
                      {t("createPost.onChainSubtitle")}
                    </span>
                  </span>
                </label>
                {onChainUnavailableReason && (
                  <p className="onchain-note">{onChainUnavailableReason}</p>
                )}
              </div>

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
