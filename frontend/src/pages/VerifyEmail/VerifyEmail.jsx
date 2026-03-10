import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { authService } from "../../api";
import Loading from "../../components/Loading/Loading";
import "./VerifyEmail.css";

function VerifyEmail() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setMessage(t("verifyEmail.invalidVerificationLink"));
      return;
    }

    verifyEmailToken(token);
  }, [searchParams]);

  const verifyEmailToken = async (token) => {
    try {
      const response = await authService.verifyEmail(token);

      if (response.success) {
        setStatus("success");
        setMessage(t("verifyEmail.verificationSuccessMessage"));

        if (response.user) {
          updateUser(response.user);
        }

        setTimeout(() => {
          navigate("/home");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(response.message || t("verifyEmail.verificationFailed"));
      }
    } catch (error) {
      setStatus("error");
      setMessage(
        error.response?.data?.message ||
          t("verifyEmail.verificationFailedMessage"),
      );
    }
  };

  if (status === "verifying") {
    return (
      <div className="verify-email-page">
        <div className="verify-email-container">
          <Loading />
          <p>{t("verifyEmail.verifyingMessage")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-email-page">
      <div className="verify-email-container">
        <div className={`verify-email-icon ${status}`}>
          {status === "success" ? (
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
          ) : (
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
          )}
        </div>

        <h1>
          {status === "success"
            ? t("verifyEmail.emailVerifiedTitle")
            : t("verifyEmail.verificationFailedTitle")}
        </h1>
        <p className="verify-message">{message}</p>

        {status === "error" && (
          <div className="verify-actions">
            <button onClick={() => navigate("/home")} className="btn-primary">
              {t("verifyEmail.goToHome")}
            </button>
            <button onClick={() => navigate("/")} className="btn-secondary">
              {t("verifyEmail.backToLogin")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyEmail;
