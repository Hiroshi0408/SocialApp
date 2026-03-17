import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import useForm from "../../hooks/useForm";
import { showError, showSuccess } from "../../utils/toast";
import LanguageToggle from "../../components/LanguageToggle/LanguageToggle";
import "./Login.css";

function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submitLockRef = useRef(false);

  const validateLogin = (values) => {
    const newErrors = {};

    if (!values.username) {
      newErrors.username = t("login.fillAllFields");
    }

    if (!values.password) {
      newErrors.password = t("login.fillAllFields");
    } else if (values.password.length < 8) {
      newErrors.password = t("login.passwordMinLength");
    }

    return newErrors;
  };

  const { values, errors, inputRefs, handleChange, handleSubmit, setErrors } =
    useForm(
      {
        username: "",
        password: "",
      },
      validateLogin,
    );

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [loading, isAuthenticated, navigate]);

  const onSubmit = async (formData) => {
    if (submitLockRef.current || isLoading || isGoogleLoading) {
      return;
    }

    submitLockRef.current = true;
    setIsLoading(true);

    try {
      await login({
        username: formData.username,
        password: formData.password,
      });

      navigate("/home");
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("login.invalidCredentials");
      setErrors({
        username: errorMessage,
      });
      showError(errorMessage);
    } finally {
      setIsLoading(false);
      submitLockRef.current = false;
    }
  };

  // Google Login Handler
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Lấy Firebase ID Token
      const idToken = await user.getIdToken();

      // Gửi token về backend để xác thực và tạo/login user
      await login({
        googleToken: idToken,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
      });

      showSuccess("Logged in successfully with Google!");
      navigate("/home");
    } catch (error) {
      console.error("Google login error:", error);

      let errorMessage = "Failed to login with Google";

      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Login cancelled";
      } else if (error.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your connection";
      }

      showError(errorMessage);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="login-container">
      <LanguageToggle />
      <div className="login-box">
        <div className="login-header">
          <h1 className="logo">SocialApp</h1>
          <p className="tagline">{t("login.tagline")}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="login-form">
          {/* Username */}
          <div className="input-group">
            <input
              ref={inputRefs.username}
              type="text"
              name="username"
              placeholder={t("login.usernameOrEmailPlaceholder")}
              value={values.username}
              onChange={handleChange}
              className={`input-field ${errors.username ? "input-error" : ""}`}
              disabled={isLoading || isGoogleLoading}
            />
            {errors.username && (
              <span className="error-text">{errors.username}</span>
            )}
          </div>

          {/* Password */}
          <div className="input-group">
            <input
              ref={inputRefs.password}
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder={t("login.passwordPlaceholder")}
              value={values.password}
              onChange={handleChange}
              className={`input-field ${errors.password ? "input-error" : ""}`}
              disabled={isLoading || isGoogleLoading}
            />
            <span
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? t("login.hidePassword") : t("login.showPassword")}
            </span>
            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? t("login.loggingIn") : t("login.logInButton")}
          </button>

          <Link to="/forgot-password" className="forgot-password">
            {t("login.forgotPassword")}
          </Link>
        </form>

        <div className="divider">
          <span>{t("login.orDivider")}</span>
        </div>
        {/* Google Login Button */}
        <button
          type="button"
          className="google-login-button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading}
        >
          <svg
            className="google-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
          >
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isGoogleLoading ? "Logging in..." : "Continue with Google"}
        </button>

        <div className="register-section">
          <p>
            {t("login.noAccount")}{" "}
            <Link to="/register">{t("login.signUp")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
