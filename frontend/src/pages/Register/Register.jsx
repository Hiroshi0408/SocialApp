import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import useForm from "../../hooks/useForm";
import { showSuccess, showError } from "../../utils/toast";
import LanguageToggle from "../../components/LanguageToggle/LanguageToggle";
import "./Register.css";

function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState("");
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const evaluatePasswordStrength = (password) => {
    if (!password) return "";
    const rules = [/.{8,}/, /[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
    const score = rules.reduce((acc, rule) => acc + rule.test(password), 0);
    if (score <= 2) return t("register.passwordStrengthWeak");
    if (score === 3) return t("register.passwordStrengthMedium");
    return t("register.passwordStrengthStrong");
  };

  const checkRequirements = (password) => {
    return {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  };

  const validateRegister = (values) => {
    const newErrors = {};

    if (!values.fullName.trim()) {
      newErrors.fullName = t("register.fullNameRequired");
    }

    if (!values.username.trim()) {
      newErrors.username = t("register.usernameRequired");
    } else if (values.username.length < 3) {
      newErrors.username = t("register.usernameMinLength");
    } else if (!/^[A-Za-z0-9_]+$/.test(values.username)) {
      newErrors.username = t("register.usernameSpecialChars");
    }

    if (!values.email.trim()) {
      newErrors.email = t("register.emailRequired");
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      newErrors.email = t("register.emailInvalid");
    }

    if (!values.password) {
      newErrors.password = t("register.passwordRequired");
    } else if (values.password.length < 8) {
      newErrors.password = t("register.passwordMinLength");
    } else {
      const currentStrength = evaluatePasswordStrength(values.password);
      if (currentStrength === t("register.passwordStrengthWeak")) {
        newErrors.password = t("register.passwordTooWeak");
      }
    }

    if (!values.confirmPassword) {
      newErrors.confirmPassword = t("register.confirmPasswordRequired");
    } else if (values.password !== values.confirmPassword) {
      newErrors.confirmPassword = t("register.passwordsDoNotMatch");
    }

    if (!values.acceptedTerms) {
      newErrors.acceptedTerms = t("register.termsRequired");
    }

    return newErrors;
  };

  const {
    values,
    errors,
    inputRefs,
    handleChange,
    handleSubmit,
    resetForm,
    setErrors,
  } = useForm(
    {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
    validateRegister,
  );

  const onSubmit = async (formData) => {
    setIsLoading(true);

    try {
      await register({
        fullName: formData.fullName,
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });

      showSuccess(t("register.registrationSuccess"));
      resetForm();
      navigate("/");
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        t("register.registrationFailed");

      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      } else {
        setErrors({
          email: errorMessage,
        });
      }
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <LanguageToggle />
      <div className="register-box">
        <div className="register-header">
          <h1 className="logo">SocialApp</h1>
          <p className="tagline">{t("register.tagline")}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="register-form">
          {/* Full Name */}
          <div className="input-group">
            <input
              ref={inputRefs.fullName}
              type="text"
              name="fullName"
              placeholder={t("register.fullNamePlaceholder")}
              value={values.fullName}
              onChange={handleChange}
              className={`input-field ${errors.fullName ? "input-error" : ""}`}
            />
            {errors.fullName && (
              <span className="error-text">{errors.fullName}</span>
            )}
          </div>

          {/* Username */}
          <div className="input-group">
            <input
              ref={inputRefs.username}
              type="text"
              name="username"
              placeholder={t("register.usernamePlaceholder")}
              value={values.username}
              onChange={handleChange}
              className={`input-field ${errors.username ? "input-error" : ""}`}
            />
            {errors.username && (
              <span className="error-text">{errors.username}</span>
            )}
          </div>

          {/* Email */}
          <div className="input-group">
            <input
              ref={inputRefs.email}
              type="email"
              name="email"
              placeholder={t("register.emailPlaceholder")}
              value={values.email}
              onChange={handleChange}
              className={`input-field ${errors.email ? "input-error" : ""}`}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="input-group">
            <div className="password-input-wrapper">
              <input
                ref={inputRefs.password}
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder={t("register.passwordPlaceholder")}
                value={values.password}
                onChange={(e) => {
                  handleChange(e);
                  setStrength(evaluatePasswordStrength(e.target.value));
                  setPasswordRequirements(checkRequirements(e.target.value));
                }}
                className={`input-field ${errors.password ? "input-error" : ""}`}
              />
              <span
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword
                  ? t("login.hidePassword")
                  : t("login.showPassword")}
              </span>
            </div>

            {/* Password Strength */}
            <div className="password-strength">
              <div className="strength-bars">
                <div
                  className={`bar ${
                    strength === t("register.passwordStrengthWeak")
                      ? "active weak"
                      : strength === t("register.passwordStrengthMedium")
                        ? "active medium"
                        : strength === t("register.passwordStrengthStrong")
                          ? "active strong"
                          : ""
                  }`}
                ></div>
                <div
                  className={`bar ${
                    strength === t("register.passwordStrengthMedium")
                      ? "active medium"
                      : strength === t("register.passwordStrengthStrong")
                        ? "active strong"
                        : ""
                  }`}
                ></div>
                <div
                  className={`bar ${
                    strength === t("register.passwordStrengthStrong")
                      ? "active strong"
                      : ""
                  }`}
                ></div>
              </div>
              <span className="strength-text">
                {strength && `${t("register.strengthPrefix")} ${strength}`}
              </span>
            </div>

            {/* Password Requirements */}
            <div className="password-requirements">
              <div
                className={`requirement ${passwordRequirements.length ? "met" : ""}`}
              >
                {t("register.requirementLength")}
              </div>
              <div
                className={`requirement ${passwordRequirements.lowercase ? "met" : ""}`}
              >
                {t("register.requirementLowercase")}
              </div>
              <div
                className={`requirement ${passwordRequirements.uppercase ? "met" : ""}`}
              >
                {t("register.requirementUppercase")}
              </div>
              <div
                className={`requirement ${passwordRequirements.number ? "met" : ""}`}
              >
                {t("register.requirementNumber")}
              </div>
              <div
                className={`requirement ${passwordRequirements.special ? "met" : ""}`}
              >
                {t("register.requirementSpecial")}
              </div>
            </div>
            {errors.password && (
              <span className="error-text">{errors.password}</span>
            )}
          </div>

          {/* Confirm Password */}
          <div className="input-group">
            <input
              ref={inputRefs.confirmPassword}
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder={t("register.confirmPasswordPlaceholder")}
              value={values.confirmPassword}
              onChange={handleChange}
              className={`input-field ${
                errors.confirmPassword ? "input-error" : ""
              }`}
            />
            {errors.confirmPassword && (
              <span className="error-text">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Terms Checkbox */}
          <div className="terms-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={values.acceptedTerms}
                onChange={handleChange}
                className="checkbox-input"
              />
              <span className="checkmark"></span>
              {t("register.termsText")}
            </label>
            {errors.acceptedTerms && (
              <span className="error-text">{errors.acceptedTerms}</span>
            )}
          </div>

          <button
            type="submit"
            className="register-button"
            disabled={isLoading}
          >
            {isLoading ? t("register.signingUp") : t("register.signUpButton")}
          </button>
        </form>

        <div className="login-section">
          <p>
            {t("register.haveAccount")}{" "}
            <Link to="/">{t("register.logInLink")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
