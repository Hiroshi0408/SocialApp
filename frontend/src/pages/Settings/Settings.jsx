import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "../../components/Sidebar/Sidebar";
import Header from "../../components/Header/Header";
import { useAuth } from "../../contexts/AuthContext";
import userService from "../../api/userService";
import authService from "../../api/authService";
import { getUserAvatar, showError, showSuccess } from "../../utils";
import "./Settings.css";

function Settings() {
  const { t } = useTranslation();
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    fullName: user?.fullName || "",
    bio: user?.bio || "",
    website: user?.website || "",
  });
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError(t("settings.selectImageFile"));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError(t("settings.imageSizeExceeded"));
      return;
    }

    try {
      setIsUploading(true);
      const response = await userService.uploadAvatar(file);

      if (response.success) {
        setAvatar(response.url);
        updateUser({ ...user, avatar: response.url });
        showSuccess(t("settings.avatarUpdatedSuccess"));
      }
    } catch (error) {
      showError(t("settings.uploadAvatarError"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setIsSaving(true);
      const response = await userService.updateProfile(formData);

      if (response.success) {
        updateUser(response.user);
        setHasChanges(false);
        showSuccess(t("settings.profileUpdatedSuccess"));
      }
    } catch (error) {
      showError(
        error.response?.data?.message || t("settings.updateProfileError"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (
      !passwordData.currentPassword ||
      !passwordData.newPassword ||
      !passwordData.confirmPassword
    ) {
      showError(t("settings.fillAllPasswordFields"));
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showError(t("settings.passwordMinLength"));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError(t("settings.passwordsDoNotMatch"));
      return;
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      showError(t("settings.passwordSameAsCurrent"));
      return;
    }

    try {
      setIsChangingPassword(true);
      await authService.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword,
      );
      showSuccess(t("settings.passwordChangedSuccess"));
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      showError(
        error.response?.data?.message || t("settings.changePasswordError"),
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="settings-page">
      <Sidebar />
      <div className="settings-content-wrapper">
        <Header />
        <main className="settings-main">
          <div className="settings-container">
            <div className="settings-content">
              <h1>{t("settings.editProfileTitle")}</h1>

              <div className="avatar-section">
                <div
                  className="settings-avatar-wrapper"
                  onClick={handleAvatarClick}
                >
                  <img
                    src={getUserAvatar({ avatar })}
                    alt={t("settings.profileAlt")}
                    className="settings-avatar"
                  />
                  <div className="settings-avatar-overlay">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="white"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                  </div>
                  {isUploading && (
                    <div className="uploading-overlay">
                      <div className="spinner"></div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleAvatarChange}
                  hidden
                />
                <button
                  className="change-avatar-btn"
                  onClick={handleAvatarClick}
                  disabled={isUploading}
                >
                  {isUploading
                    ? t("settings.uploading")
                    : t("settings.changeProfilePhoto")}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="settings-form">
                <div className="form-group">
                  <label htmlFor="username">{t("settings.usernameLabel")}</label>
                  <input
                    type="text"
                    id="username"
                    value={user?.username || ""}
                    disabled
                    className="input-disabled"
                  />
                  <span className="help-text">
                    {t("settings.usernameCannotChange")}
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="email">{t("settings.emailLabel")}</label>
                  <input
                    type="email"
                    id="email"
                    value={user?.email || ""}
                    disabled
                    className="input-disabled"
                  />
                  <span className="help-text">
                    {user?.isEmailVerified
                      ? t("settings.emailVerified")
                      : t("settings.emailNotVerified")}
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="fullName">{t("settings.fullNameLabel")}</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    maxLength={50}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio">{t("settings.bioLabel")}</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    maxLength={150}
                    rows={4}
                  />
                  <span className="char-count">
                    {formData.bio.length}/150
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="website">{t("settings.websiteLabel")}</label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder={t("settings.websitePlaceholder")}
                  />
                </div>

                <button
                  type="submit"
                  className="save-btn"
                  disabled={isSaving || !hasChanges}
                >
                  {isSaving ? t("settings.saving") : t("settings.saveChanges")}
                </button>
              </form>

              <div className="password-section">
                <h2>{t("settings.changePasswordTitle")}</h2>
                <form onSubmit={handleChangePassword} className="password-form">
                  <div className="form-group">
                    <label htmlFor="currentPassword">
                      {t("settings.currentPasswordLabel")}
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      name="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordInputChange}
                      placeholder={t("settings.currentPasswordPlaceholder")}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="newPassword">
                      {t("settings.newPasswordLabel")}
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      name="newPassword"
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange}
                      placeholder={t("settings.newPasswordPlaceholder")}
                      minLength={6}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">
                      {t("settings.confirmNewPasswordLabel")}
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      name="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange}
                      placeholder={t("settings.confirmNewPasswordPlaceholder")}
                    />
                  </div>

                  <button
                    type="submit"
                    className="save-btn"
                    disabled={
                      isChangingPassword ||
                      !passwordData.currentPassword ||
                      !passwordData.newPassword ||
                      !passwordData.confirmPassword
                    }
                  >
                    {isChangingPassword
                      ? t("settings.changing")
                      : t("settings.changePasswordButton")}
                  </button>
                </form>
              </div>

              <div className="danger-zone">
                <h3>{t("settings.accountActionsTitle")}</h3>
                <button className="logout-btn" onClick={handleLogout}>
                  {t("settings.logout")}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Settings;
