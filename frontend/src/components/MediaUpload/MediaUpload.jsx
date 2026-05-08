import React, { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import uploadService from "../../api/uploadService";
import { showError } from "../../utils/toast";
import { POST_LIMITS } from "../../constants";
import "./MediaUpload.css";

// Đa-media: ảnh tới MAX_MEDIA, hoặc 1 video (mutually exclusive theo Instagram).
// Caller giữ state media[] qua prop `media`; mỗi thay đổi gọi `onChange(newMedia)`.
// Mỗi item: { type: "image"|"video", url, duration? }
function MediaUpload({ media = [], onChange }) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const hasVideo = media.some((m) => m.type === "video");
  const hasImage = media.some((m) => m.type === "image");
  const remainingSlots = Math.max(0, POST_LIMITS.MAX_MEDIA - media.length);
  const canAddMore = !uploading && !hasVideo && remainingSlots > 0;

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      // Phân tích batch: nếu có video → chỉ nhận 1 video duy nhất, ngược lại nhận tới remainingSlots ảnh.
      const videoFile = files.find((f) => f.type.startsWith("video/"));
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));

      if (videoFile && (hasImage || hasVideo)) {
        showError(t("mediaUpload.videoExclusiveError"));
        return;
      }

      if (videoFile) {
        // Validate video size 100MB
        if (videoFile.size > 100 * 1024 * 1024) {
          showError(t("mediaUpload.fileSizeError", { size: 100 }));
          return;
        }
        try {
          setUploading(true);
          setUploadProgress(20);
          const response = await uploadService.uploadVideo(videoFile);
          setUploadProgress(100);
          if (response.success) {
            onChange([
              {
                type: "video",
                url: response.url,
                duration: response.duration || 0,
              },
            ]);
          }
        } catch (error) {
          showError(
            error.response?.data?.message || t("mediaUpload.uploadFailedError"),
          );
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
        return;
      }

      // Image batch
      if (hasVideo) {
        showError(t("mediaUpload.videoExclusiveError"));
        return;
      }
      if (imageFiles.length === 0) {
        showError(t("mediaUpload.selectMediaFileError"));
        return;
      }

      const accepted = imageFiles.slice(0, remainingSlots);
      const rejected = imageFiles.length - accepted.length;
      if (rejected > 0) {
        showError(t("mediaUpload.tooManyError", { max: POST_LIMITS.MAX_MEDIA }));
      }

      // Validate size từng file (10MB cho ảnh)
      for (const f of accepted) {
        if (f.size > 10 * 1024 * 1024) {
          showError(t("mediaUpload.fileSizeError", { size: 10 }));
          return;
        }
      }

      try {
        setUploading(true);
        setUploadProgress(20);
        // Upload song song — tăng tốc với nhiều ảnh
        const results = await Promise.all(
          accepted.map((f) => uploadService.uploadImage(f)),
        );
        setUploadProgress(100);
        const newItems = results
          .filter((r) => r.success)
          .map((r) => ({ type: "image", url: r.url, duration: 0 }));
        onChange([...media, ...newItems]);
      } catch (error) {
        showError(
          error.response?.data?.message || t("mediaUpload.uploadFailedError"),
        );
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [media, hasImage, hasVideo, remainingSlots, onChange, t],
  );

  const handleFileInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = ""; // reset để có thể chọn lại cùng file
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canAddMore) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (canAddMore) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const removeItem = (index) => {
    const next = media.filter((_, i) => i !== index);
    onChange(next);
  };

  // Empty state — placeholder + button
  if (media.length === 0) {
    return (
      <div className="media-upload">
        <div
          className={`upload-empty ${isDragging ? "dragging" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !uploading && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {uploading ? (
            <div className="uploading-overlay">
              <div className="spinner" />
              <p>{t("mediaUpload.uploadingButton")}</p>
            </div>
          ) : (
            <div className="upload-placeholder">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <p>{t("mediaUpload.clickToUpload")}</p>
              <span className="supported-formats">
                {t("mediaUpload.imageFormats")}
                <br />
                {t("mediaUpload.videoFormats")}
              </span>
              <span className="multi-hint">
                {t("mediaUpload.multiHint", { max: POST_LIMITS.MAX_MEDIA })}
              </span>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
          multiple
          onChange={handleFileInputChange}
          className="file-input"
          disabled={uploading}
        />
      </div>
    );
  }

  // Có ít nhất 1 media — render grid + nút thêm
  return (
    <div className="media-upload">
      <div
        className={`media-grid ${isDragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {media.map((item, idx) => (
          <div key={`${item.url}-${idx}`} className="media-tile">
            {item.type === "video" ? (
              <video src={item.url} controls className="tile-media" />
            ) : (
              <img
                src={item.url}
                alt={t("mediaUpload.previewAlt")}
                className="tile-media"
              />
            )}
            <button
              type="button"
              className="tile-remove-btn"
              onClick={() => removeItem(idx)}
              aria-label={t("mediaUpload.removeItem")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
            {item.type === "image" && media.length > 1 && (
              <span className="tile-index">
                {idx + 1}/{media.length}
              </span>
            )}
          </div>
        ))}
        {canAddMore && (
          <button
            type="button"
            className="media-tile add-tile"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>
              {t("mediaUpload.addMore", { count: remainingSlots })}
            </span>
          </button>
        )}
      </div>

      {uploading && (
        <div className="upload-progress">
          <div
            className="progress-bar"
            style={{ width: `${uploadProgress}%` }}
          />
          <span>{t("mediaUpload.uploadingButton")}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        multiple
        onChange={handleFileInputChange}
        className="file-input"
        disabled={uploading}
      />
    </div>
  );
}

export default MediaUpload;
