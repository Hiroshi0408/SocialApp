import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useContext,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useSocket } from "../../contexts/SocketContext";
import { ThemeContext } from "../../contexts/ThemeContext";
import { getUserAvatar } from "../../utils";
import { notificationService } from "../../api";
import ChatPopover from "../Chat/ChatPopover";
import userService from "../../api/userService";
import { useTranslation } from "react-i18next";
import { languages } from "../../localization/languageList";
import "./Header.css";

function Header() {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { unreadNotifications, setUnreadNotifications } = useSocket();
  const [chatOpen, setChatOpen] = useState(false);

  const [suggestions, setSuggestions] = useState({ users: [] });
  const [openSuggest, setOpenSuggest] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const userAvatar = useMemo(() => getUserAvatar(user), [user]);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const response = await notificationService.getUnreadCount();
        if (response.success) {
          const count = response.count || 0;
          setUnreadCount(count);
          if (setUnreadNotifications) {
            setUnreadNotifications(count);
          }
        }
      } catch (err) {
        setUnreadCount(0);
        if (setUnreadNotifications) {
          setUnreadNotifications(0);
        }
      }
    };

    loadUnreadCount();
  }, [setUnreadNotifications]);

  useEffect(() => {
    setUnreadCount(unreadNotifications);
  }, [unreadNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest(".nav-profile")) {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions({ users: [] });
      setOpenSuggest(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setLoadingSuggest(true);
        setOpenSuggest(true);

        const resp = await userService.searchUsers(q);
        setSuggestions({ users: (resp?.users || []).slice(0, 5) });
      } catch (e) {
        setSuggestions({ users: [] });
      } finally {
        setLoadingSuggest(false);
      }
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    const onDown = (e) => {
      if (openSuggest && !e.target.closest(".header-search"))
        setOpenSuggest(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openSuggest]);

  const handleSearch = useCallback(
    (e) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (q) {
        setOpenSuggest(false);
        navigate(`/search?type=users&q=${encodeURIComponent(q)}`);
      }
    },
    [searchQuery, navigate],
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate("/");
  }, [logout, navigate]);

  const isActive = useCallback(
    (path) => location.pathname === path,
    [location.pathname],
  );

  return (
    <header className="header">
      <div className="header-container">
        <form onSubmit={handleSearch} className="header-search" role="search">
          <input
            type="text"
            placeholder={t("header.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label={t("header.searchPlaceholder")}
          />
          {openSuggest && (
            <div className="search-suggest">
              {loadingSuggest && (
                <div className="suggest-item muted">
                  {t("header.searching")}
                </div>
              )}

              {!loadingSuggest && suggestions.users.length === 0 && (
                <div className="suggest-item muted">
                  {t("header.noSuggestions")}
                </div>
              )}

              {suggestions.users.length > 0 && (
                <>
                  <div className="suggest-title">{t("header.users")}</div>
                  {suggestions.users.map((u) => (
                    <button
                      key={u._id}
                      type="button"
                      className="suggest-item"
                      onClick={() => {
                        setOpenSuggest(false);
                        setSearchQuery("");
                        navigate(`/profile/${u.username}`);
                      }}
                    >
                      <img className="suggest-avatar" src={u.avatar} alt="" />
                      <div className="suggest-text">
                        <div className="suggest-primary">{u.username}</div>
                        <div className="suggest-secondary">{u.fullName}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* CTA: Enter full search */}
              <button
                type="button"
                className="suggest-item suggest-cta"
                onClick={() => {
                  const q = searchQuery.trim();
                  if (q)
                    navigate(`/search?type=users&q=${encodeURIComponent(q)}`);
                }}
              >
                {t("header.searchFor", { query: searchQuery.trim() })}
              </button>
            </div>
          )}
        </form>

        <nav className="header-nav" aria-label="Main navigation">
          <button
            className={`nav-icon ${isActive("/home") ? "active" : ""}`}
            onClick={() => navigate("/home")}
            aria-label={t("header.home")}
            aria-current={isActive("/home") ? "page" : undefined}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={isActive("/home") ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M9.005 16.545a2.997 2.997 0 0 1 2.997-2.997A2.997 2.997 0 0 1 15 16.545V22h7V11.543L12 2 2 11.543V22h7.005Z" />
            </svg>
          </button>

          <button
            className={`nav-icon ${
              isActive("/notifications") ? "active" : ""
            }`}
            onClick={() => navigate("/notifications")}
            aria-label={
              unreadCount > 0
                ? `${t("header.notifications")}, ${unreadCount} unread`
                : t("header.notifications")
            }
            aria-current={isActive("/notifications") ? "page" : undefined}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={isActive("/notifications") ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge" aria-hidden="true">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="nav-icon"
            onClick={() => setChatOpen((v) => !v)}
            aria-label={t("header.chats")}
            title={t("header.chats")}
          >
            {/* icon xám tạm */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
            </svg>
          </button>

          <button
            className="nav-icon"
            onClick={toggleTheme}
            aria-label={t("header.toggleTheme")}
          >
            {theme === "light" ? (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>

          <div className="nav-profile">
            <button
              className={`nav-icon avatar-wrapper ${
                isActive("/profile") ? "active" : ""
              }`}
              onClick={() => setShowMenu(!showMenu)}
              aria-label={t("header.profileMenu")}
              aria-expanded={showMenu}
              aria-haspopup="true"
            >
              <div
                className={`avatar-small ${
                  isActive("/profile") ? "avatar-active" : ""
                }`}
              >
                <img src={userAvatar} alt={t("header.profile")} />
              </div>
            </button>

            {showMenu && (
              <div
                className="profile-menu"
                role="menu"
                aria-label="Profile options"
              >
                <button
                  onClick={() => {
                    navigate("/profile");
                    setShowMenu(false);
                  }}
                  role="menuitem"
                  aria-label={t("header.goToProfile")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {t("header.profile")}
                </button>
                <button
                  onClick={() => {
                    navigate("/profile?tab=saved");
                    setShowMenu(false);
                  }}
                  role="menuitem"
                  aria-label={t("header.goToSaved")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  {t("header.saved")}
                </button>
                <button
                  onClick={() => {
                    navigate("/settings");
                    setShowMenu(false);
                  }}
                  role="menuitem"
                  aria-label={t("header.settings")}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v6" />
                  </svg>
                  {t("header.settings")}
                </button>
                <div className="menu-divider" role="separator"></div>
                <div className="language-menu-section">
                  <div className="menu-sub-header">{t("header.language")}</div>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        i18n.changeLanguage(lang.code);
                        setShowMenu(false);
                      }}
                      role="menuitem"
                      aria-label={`Switch to ${lang.label}`}
                    >
                      <span
                        className={`lang-icon ${
                          i18n.language === lang.code ? "active" : ""
                        }`}
                      >
                        {i18n.language === lang.code && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </span>
                      {lang.label}
                    </button>
                  ))}
                </div>
                <div className="menu-divider" role="separator"></div>
                <button
                  onClick={handleLogout}
                  className="logout-btn"
                  role="menuitem"
                  aria-label={t("header.logout")}
                >
                  {t("header.logout")}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
      <ChatPopover open={chatOpen} onClose={() => setChatOpen(false)} />
    </header>
  );
}

export default memo(Header);
