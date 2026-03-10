import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import uploadService from "../../api/uploadService";
import { showError } from "../../utils/toast";
import "./MediaUpload.css";

function MediaUpload({ onUpload, currentMedia }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(currentMedia?.url || null);
  const [mediaType, setMediaType] = useState(currentMedia?.type || null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      showError(t("mediaUpload.selectMediaFileError"));
      return;
    }

    // Check file size
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    const maxSizeMB = isVideo ? 100 : 10;

    if (file.size > maxSize) {
      showError(t("mediaUpload.fileSizeError", { size: maxSizeMB }));
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setMediaType(isVideo ? "video" : "image");
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploading(true);
      setUploadProgress(10);

      let response;
      if (isVideo) {
        response = await uploadService.uploadVideo(file);
      } else {
        response = await uploadService.uploadImage(file);
      }

      setUploadProgress(100);

      if (response.success && onUpload) {
        onUpload({
          url: response.url,
          type: response.mediaType || (isVideo ? "video" : "image"),
          duration: response.duration || 0,
          width: response.width,
          height: response.height,
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
      showError(
        error.response?.data?.message || t("mediaUpload.uploadFailedError"),
      );
      setPreview(null);
      setMediaType(null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const clearMedia = () => {
    setPreview(null);
    setMediaType(null);
    if (onUpload) {
      onUpload(null);
    }
  };

  return (
    <div className="media-upload">
      <div className="upload-preview">
        {preview && (
          <>
            {mediaType === "video" ? (
              <video
                ref={videoRef}
                src={preview}
                controls
                className="video-preview"
              />
            ) : (
              <img
                src={preview}
                alt={t("mediaUpload.previewAlt")}
                className="image-preview"
              />
            )}
            <button className="clear-media-btn" onClick={clearMedia}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </>
        )}
        {uploading && (
          <div className="uploading-overlay">
            <div className="spinner"></div>
          </div>
        )}
        {!preview && !uploading && (
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
          </div>
        )}
      </div>

      {uploading && (
        <div className="upload-progress">
          <div
            className="progress-bar"
            style={{ width: `${uploadProgress}%` }}
          />
          <span>
            {t("mediaUpload.uploadingProgress", {
              type:
                mediaType === "video"
                  ? t("mediaUpload.video")
                  : t("mediaUpload.image"),
            })}
          </span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
        onChange={handleFileChange}
        className="file-input"
        disabled={uploading}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="upload-button"
        disabled={uploading}
      >
        {uploading
          ? t("mediaUpload.uploadingButton")
          : preview
            ? t("mediaUpload.changeMediaButton")
            : t("mediaUpload.selectMediaButton")}
      </button>
    </div>
  );
}

export default MediaUpload;
