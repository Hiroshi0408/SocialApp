import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "../../api";
import { showSuccess, showError } from "../../utils/toast";
import "./ForgotPassword.css";

function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      showError(t("forgotPassword.enterEmailRequired"));
      return;
    }

    try {
      setIsLoading(true);
      const response = await authService.forgotPassword(email);

      if (response.success) {
        setIsSubmitted(true);
        showSuccess(t("forgotPassword.resetLinkSent"));
      }
    } catch (error) {
      showError(
        error.response?.data?.message ||
          t("forgotPassword.sendResetEmailFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-password-container">
          <div className="success-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1>{t("forgotPassword.checkEmailTitle")}</h1>
          <p>
            {t("forgotPassword.emailSentMessagePrefix")}{" "}
            <strong>{email}</strong>
            {t("forgotPassword.emailSentMessageSuffix")}
          </p>
          <p className="helper-text">{t("forgotPassword.emailHelperText")}</p>
          <div className="form-footer">
            <Link to="/">{t("forgotPassword.backToLogin")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <h1>{t("forgotPassword.resetPasswordTitle")}</h1>
        <p className="description">
          {t("forgotPassword.resetPasswordDescription")}
        </p>

        <form onSubmit={handleSubmit} className="forgot-password-form">
          <div className="form-group">
            <label htmlFor="email">
              {t("forgotPassword.emailAddressLabel")}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("forgotPassword.enterEmailPlaceholder")}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading
              ? t("forgotPassword.sendingButton")
              : t("forgotPassword.sendResetLinkButton")}
          </button>
        </form>

        <div className="form-footer">
          <Link to="/">{t("forgotPassword.backToLogin")}</Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
