import React, { useState } from "react";
import storyService from "../../api/storyService";
import uploadService from "../../api/uploadService";
import { showError, showSuccess } from "../../utils";
import "./Stories.css";

function CreateStory({ onClose, onStoryCreated }) {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showError("Image must be less than 10MB");
        return;
      }

      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!image) {
      showError("Please select an image");
      return;
    }

    try {
      setIsUploading(true);

      const uploadResponse = await uploadService.uploadImage(image);
      if (!uploadResponse.success) {
        throw new Error("Failed to upload image");
      }

      const storyResponse = await storyService.createStory({
        image: uploadResponse.url,
        caption,
      });

      if (storyResponse.success) {
        showSuccess("Story created successfully");
        if (onStoryCreated) {
          onStoryCreated(storyResponse.story);
        }
        onClose();
      }
    } catch (error) {
      showError("Failed to create story");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="create-story-overlay">
      <div className="create-story-modal">
        <div className="create-story-header">
          <h3>Create Story</h3>
          <button onClick={onClose} className="close-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div className="create-story-content">
          {!imagePreview ? (
            <label className="image-upload-area">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
              </svg>
              <span>Click to upload image</span>
            </label>
          ) : (
            <div className="image-preview">
              <img src={imagePreview} alt="Preview" />
              <button
                className="remove-image"
                onClick={() => {
                  setImage(null);
                  setImagePreview(null);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
          )}

          <textarea
            placeholder="Add a caption (optional)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            className="story-caption-input"
          />
        </div>

        <div className="create-story-footer">
          <button onClick={onClose} className="cancel-btn" disabled={isUploading}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="submit-btn"
            disabled={!image || isUploading}
          >
            {isUploading ? "Creating..." : "Share Story"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateStory;
