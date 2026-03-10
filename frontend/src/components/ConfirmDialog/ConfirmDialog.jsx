import React from "react";
import { useTranslation } from "react-i18next";
import "./ConfirmDialog.css";

function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  isDangerous = false,
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="confirm-title">
          {title || t("confirmDialog.defaultTitle")}
        </h3>
        <p className="confirm-message">
          {message || t("confirmDialog.defaultMessage")}
        </p>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onClose}>
            {cancelText || t("confirmDialog.cancel")}
          </button>
          <button
            className={`confirm-btn ${isDangerous ? "danger" : ""}`}
            onClick={handleConfirm}
          >
            {confirmText || t("confirmDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
