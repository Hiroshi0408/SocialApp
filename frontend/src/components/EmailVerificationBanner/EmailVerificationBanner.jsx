import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../api";
import { showSuccess, showError } from "../../utils/toast";
import "./EmailVerificationBanner.css";

function EmailVerificationBanner() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isResending, setIsResending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!user || user.isEmailVerified || isDismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (isResending) return;

    try {
      setIsResending(true);
      const response = await authService.resendVerification();

      if (response.success) {
        showSuccess(t("emailVerificationBanner.success"));
      }
    } catch (error) {
      showError(
        error.response?.data?.message || t("emailVerificationBanner.error")
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="email-verification-banner">
      <div className="banner-content">
        <div className="banner-icon">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="banner-text">
          <strong>{t("emailVerificationBanner.title")}</strong>
          <span>{t("emailVerificationBanner.message")}</span>
        </div>
        <div className="banner-actions">
          <button
            onClick={handleResendVerification}
            disabled={isResending}
            className="resend-btn"
          >
            {isResending
              ? t("emailVerificationBanner.sending")
              : t("emailVerificationBanner.resend")}
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="dismiss-btn"
            aria-label={t("emailVerificationBanner.dismiss")}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailVerificationBanner;
