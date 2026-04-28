import React from "react";
import { useTranslation } from "react-i18next";
import { SEPOLIA_ETHERSCAN_BASE } from "../../constants";
import "./TxStatusModal.css";

/**
 * Component dùng chung cho mọi tx blockchain.
 * Caller tự quản lý state (status, txHash, errorMsg) và truyền vào qua props.
 *
 * Props:
 *   isOpen      — bool
 *   onClose     — fn (chỉ cho phép đóng khi idle/success/failed/rejected)
 *   status      — "idle" | "signing" | "pending" | "success" | "failed" | "rejected"
 *   txHash      — string | null
 *   errorMsg    — string | null
 *   title       — string (i18n key hoặc text, optional)
 *   onRetry     — fn (optional — hiện nút retry khi failed/rejected)
 *   children    — form content khi status === "idle"
 */
function TxStatusModal({
  isOpen,
  onClose,
  status = "idle",
  txHash = null,
  errorMsg = null,
  title,
  onRetry,
  children,
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const canClose = ["idle", "success", "failed", "rejected"].includes(status);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && canClose) onClose();
  };

  return (
    <div className="tx-modal-backdrop" onClick={handleBackdropClick}>
      <div className="tx-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="tx-modal-header">
          <h2 className="tx-modal-title">{title || t("charity.tx.title")}</h2>
          {canClose && (
            <button
              type="button"
              className="tx-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div className="tx-modal-body">
          {status === "idle" && children}

          {status === "signing" && (
            <div className="tx-modal-status tx-modal-status--signing">
              <div className="tx-modal-spinner" />
              <p className="tx-modal-status-text">{t("charity.tx.signing")}</p>
              <p className="tx-modal-status-hint">{t("charity.tx.signingHint")}</p>
            </div>
          )}

          {status === "pending" && (
            <div className="tx-modal-status tx-modal-status--pending">
              <div className="tx-modal-spinner" />
              <p className="tx-modal-status-text">{t("charity.tx.pending")}</p>
              {txHash && (
                <a
                  href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-modal-etherscan-link"
                >
                  {t("charity.tx.viewOnEtherscan")} ↗
                </a>
              )}
            </div>
          )}

          {status === "success" && (
            <div className="tx-modal-status tx-modal-status--success">
              <div className="tx-modal-icon tx-modal-icon--success">✓</div>
              <p className="tx-modal-status-text">{t("charity.tx.success")}</p>
              {txHash && (
                <a
                  href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="tx-modal-etherscan-link"
                >
                  {t("charity.tx.viewOnEtherscan")} ↗
                </a>
              )}
              <button type="button" className="tx-modal-btn tx-modal-btn--primary" onClick={onClose}>
                {t("charity.tx.close")}
              </button>
            </div>
          )}

          {status === "failed" && (
            <div className="tx-modal-status tx-modal-status--failed">
              <div className="tx-modal-icon tx-modal-icon--failed">✕</div>
              <p className="tx-modal-status-text">{t("charity.tx.failed")}</p>
              {errorMsg && (
                <p className="tx-modal-error-msg">{errorMsg}</p>
              )}
              <div className="tx-modal-btn-row">
                {onRetry && (
                  <button type="button" className="tx-modal-btn tx-modal-btn--primary" onClick={onRetry}>
                    {t("charity.tx.retry")}
                  </button>
                )}
                <button type="button" className="tx-modal-btn tx-modal-btn--ghost" onClick={onClose}>
                  {t("charity.tx.close")}
                </button>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <div className="tx-modal-status tx-modal-status--rejected">
              <div className="tx-modal-icon tx-modal-icon--rejected">✕</div>
              <p className="tx-modal-status-text">{t("charity.tx.rejected")}</p>
              <div className="tx-modal-btn-row">
                {onRetry && (
                  <button type="button" className="tx-modal-btn tx-modal-btn--primary" onClick={onRetry}>
                    {t("charity.tx.retry")}
                  </button>
                )}
                <button type="button" className="tx-modal-btn tx-modal-btn--ghost" onClick={onClose}>
                  {t("charity.tx.close")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TxStatusModal;
