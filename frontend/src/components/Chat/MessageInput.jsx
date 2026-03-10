import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { uploadService } from "../../api";
import { showError } from "../../utils/toast";
import "./MessageInput.css";

function MessageInput({ onSendMessage, onTyping }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    setMessage(e.target.value);

    if (!isTyping && onTyping) {
      setIsTyping(true);
      onTyping();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError(t("messagesPage.selectImageFile"));
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim() && !selectedImage) return;

    try {
      let imageUrl = null;

      if (selectedImage) {
        setUploading(true);
        const response = await uploadService.uploadImage(selectedImage);
        if (response.success) {
          imageUrl = response.url;
        }
      }

      if (imageUrl) {
        onSendMessage(message.trim() || "", "image", imageUrl);
      } else {
        onSendMessage(message.trim());
      }

      setMessage("");
      setSelectedImage(null);
      setImagePreview(null);
      setIsTyping(false);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      showError(t("messagesPage.sendMessageError"));
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      {imagePreview && (
        <div className="message-image-preview">
          <img src={imagePreview} alt={t("messagesPage.previewAlt")} />
          <button
            type="button"
            className="message-image-remove"
            onClick={handleRemoveImage}
          >
            ×
          </button>
        </div>
      )}
      <div className="message-input-wrapper">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="message-image-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          className="message-input"
          placeholder={t("messagesPage.typeMessagePlaceholder")}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={uploading}
        />
        <button
          type="submit"
          className="message-send-button"
          disabled={(!message.trim() && !selectedImage) || uploading}
        >
          {uploading ? (
            <span>...</span>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

export default MessageInput;
