import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { groupService, uploadService } from "../../api";
import { showError, showSuccess } from "../../utils/toast";
import "./EditGroupModal.css";

function EditGroupModal({ isOpen, group, onClose, onUpdated }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setName(group.name || "");
      setDescription(group.description || "");
      setImage(group.image || "");
    }
  }, [isOpen, group]);

  if (!isOpen) return null;

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadService.uploadImage(file);
      if (res?.success) setImage(res.url);
    } catch (err) {
      showError(err?.response?.data?.message || t("editGroup.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showError(t("editGroup.nameRequired"));
      return;
    }
    try {
      setSubmitting(true);
      const res = await groupService.updateGroup(group.id, {
        name: name.trim(),
        description: description.trim(),
        image,
      });
      if (res?.success) {
        showSuccess(t("editGroup.saved"));
        onUpdated?.(res.group);
      }
    } catch (err) {
      showError(err?.response?.data?.message || t("editGroup.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="edit-group-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{t("editGroup.title")}</h2>

        <label className="edit-group-field">
          <span>{t("editGroup.image")}</span>
          <div className="edit-group-image">
            {image ? (
              <img src={image} alt="preview" />
            ) : (
              <div className="edit-group-image-placeholder" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              disabled={uploading}
            />
          </div>
        </label>

        <label className="edit-group-field">
          <span>{t("editGroup.name")}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
          />
        </label>

        <label className="edit-group-field">
          <span>{t("editGroup.description")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
          />
        </label>

        <div className="edit-group-actions">
          <button className="btn-secondary" onClick={onClose}>
            {t("editGroup.cancel")}
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || uploading}
          >
            {submitting ? t("editGroup.saving") : t("editGroup.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditGroupModal;
