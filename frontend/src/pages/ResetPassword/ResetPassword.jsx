import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { authService } from "../../api";
import { showSuccess, showError } from "../../utils/toast";
import "./ResetPassword.css";

function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const token = searchParams.get("token");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      showError(t("resetPassword.invalidResetLink"));
      return;
    }

    if (!password) {
      showError(t("resetPassword.enterNewPasswordRequired"));
      return;
    }

    if (password.length < 6) {
      showError(t("resetPassword.passwordMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      showError(t("resetPassword.passwordsDoNotMatch"));
      return;
    }

    try {
      setIsLoading(true);
      const response = await authService.resetPassword(token, password);

      if (response.success) {
        showSuccess(t("resetPassword.resetSuccessMessage"));

        setTimeout(() => {
          navigate("/home");
        }, 1500);
      }
    } catch (error) {
      showError(
        error.response?.data?.message || t("resetPassword.resetFailedMessage"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="error-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1>{t("resetPassword.invalidLinkTitle")}</h1>
          <p>{t("resetPassword.invalidLinkDescription")}</p>
          <div className="form-footer">
            <Link to="/forgot-password">
              {t("resetPassword.requestNewLink")}
            </Link>
            <Link to="/">{t("resetPassword.backToLogin")}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <h1>{t("resetPassword.resetPasswordTitle")}</h1>
        <p className="description">
          {t("resetPassword.resetPasswordDescription")}
        </p>

        <form onSubmit={handleSubmit} className="reset-password-form">
          <div className="form-group">
            <label htmlFor="password">
              {t("resetPassword.newPasswordLabel")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("resetPassword.newPasswordPlaceholder")}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {t("resetPassword.confirmPasswordLabel")}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("resetPassword.confirmPasswordPlaceholder")}
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading
              ? t("resetPassword.resettingButton")
              : t("resetPassword.resetPasswordButton")}
          </button>
        </form>

        <div className="form-footer">
          <Link to="/">{t("resetPassword.backToLogin")}</Link>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
