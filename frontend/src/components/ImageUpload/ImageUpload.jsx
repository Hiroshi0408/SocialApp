import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import uploadService from "../../api/uploadService";
import { FILE_LIMITS } from "../../constants";
import { showError } from "../../utils/toast";
import "./ImageUpload.css";

function ImageUpload({ onUpload, currentImage }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState(currentImage || null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError(t("imageUpload.selectImageFileError"));
      return;
    }

    if (file.size > FILE_LIMITS.IMAGE_MAX_SIZE) {
      showError(
        t("imageUpload.fileSizeError", { size: FILE_LIMITS.IMAGE_MAX_SIZE_MB }),
      );
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setUploading(true);

      const response = await uploadService.uploadImage(file);

      if (response.success && onUpload) {
        onUpload(response.url);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      showError(
        error.response?.data?.message || t("imageUpload.uploadFailedError"),
      );
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-upload">
      <div className="upload-preview">
        {preview ? (
          <img src={preview} alt={t("imageUpload.previewAlt")} />
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
            <p>{t("imageUpload.clickToUpload")}</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
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
          ? t("imageUpload.uploadingButton")
          : preview
            ? t("imageUpload.changeImageButton")
            : t("imageUpload.selectImageButton")}
      </button>
    </div>
  );
}

export default ImageUpload;
