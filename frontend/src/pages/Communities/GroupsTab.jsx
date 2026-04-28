import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CreateGroupModal from "../../components/CreateGroupModal/CreateGroupModal";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { groupService } from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import { showError, showSuccess } from "../../utils/toast";
import "./GroupsTab.css";

const FALLBACK_COVER = "/images/default-avatar.jpg";

function GroupCardSkeleton({ variant = "suggested" }) {
  return (
    <div
      className={`gt-skeleton gt-skeleton--${variant}`}
      aria-hidden
    >
      <div className="gt-skeleton-cover" />
      <div className="gt-skeleton-body">
        <div className="gt-skeleton-line gt-skeleton-line--title" />
        <div className="gt-skeleton-line gt-skeleton-line--short" />
      </div>
    </div>
  );
}

function GroupsTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [myGroups, setMyGroups] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joiningGroupId, setJoiningGroupId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Group endpoints đều require auth — guest sẽ bị 401 + redirect.
    // Skip fetch khi chưa login để render login prompt thay vào.
    if (!user) {
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    async function fetchGroupsData() {
      try {
        setLoading(true);
        const [joinedRes, suggestedRes] = await Promise.all([
          groupService.getJoinedGroups(),
          groupService.getSuggestedGroups(),
        ]);
        if (!mounted) return;
        if (joinedRes?.success) setMyGroups(joinedRes.groups || []);
        if (suggestedRes?.success) setSuggested(suggestedRes.groups || []);
      } catch {
        showError(t("group.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchGroupsData();
    return () => {
      mounted = false;
    };
  }, [t, user]);

  const handleGroupCreated = (newGroup) => {
    if (!newGroup) return;
    setMyGroups((prev) => [newGroup, ...prev]);
    setSuggested((prev) => prev.filter((g) => g.id !== newGroup.id));
  };

  const handleJoinGroup = async (e, groupId) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setJoiningGroupId(groupId);
      const res = await groupService.joinGroup(groupId);
      if (res?.success && res.group) {
        const joined = res.group;
        setMyGroups((prev) =>
          prev.some((g) => g.id === joined.id) ? prev : [joined, ...prev]
        );
        setSuggested((prev) => prev.filter((g) => g.id !== groupId));
        showSuccess(t("group.joinedToast"));
      }
    } catch {
      showError(t("group.joinFailed"));
    } finally {
      setJoiningGroupId(null);
    }
  };

  // Search lọc client-side trong cả 2 list — đủ cho phạm vi đồ án.
  // BE chưa có search endpoint cho group nên giữ ở FE.
  const filteredMy = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return myGroups;
    return myGroups.filter((g) => g.name?.toLowerCase().includes(q));
  }, [myGroups, search]);

  const filteredSuggested = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suggested;
    return suggested.filter((g) => g.name?.toLowerCase().includes(q));
  }, [suggested, search]);

  if (!user) {
    return (
      <div className="gt-root">
        <div className="gt-empty">
          <div className="gt-empty-illustration" aria-hidden>
            <svg viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="56" fill="url(#gtg-guest)" opacity="0.18" />
              <path
                d="M40 70c0-7 6-13 13-13h14c7 0 13 6 13 13v8H40v-8Z"
                fill="#1d9bf0"
                opacity="0.85"
              />
              <circle cx="60" cy="46" r="10" fill="#1d9bf0" opacity="0.85" />
              <defs>
                <linearGradient id="gtg-guest" x1="0" y1="0" x2="120" y2="120">
                  <stop stopColor="#1d9bf0" />
                  <stop offset="1" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3 className="gt-empty-title">{t("group.guest.title")}</h3>
          <p className="gt-empty-text">{t("group.guest.description")}</p>
          <Link to="/" className="gt-empty-cta">
            {t("group.guest.cta")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="gt-root">
      {/* Toolbar: search + create */}
      <div className="gt-toolbar">
        <div className="gt-search-wrap">
          <svg
            className="gt-search-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="gt-search-input"
            placeholder={t("group.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="gt-create-btn"
          onClick={() => setIsModalOpen(true)}
        >
          + {t("group.createGroup")}
        </button>
      </div>

      {/* My Groups — compact cards */}
      <section className="gt-section">
        <header className="gt-section-head">
          <h2 className="gt-section-title">
            {t("group.myGroups")}
            <span className="gt-section-count">({myGroups.length})</span>
          </h2>
        </header>

        {loading ? (
          <div className="gt-grid gt-grid--compact">
            {Array.from({ length: 3 }).map((_, i) => (
              <GroupCardSkeleton key={i} variant="compact" />
            ))}
          </div>
        ) : filteredMy.length === 0 ? (
          <div className="gt-empty">
            <div className="gt-empty-illustration" aria-hidden>
              <svg viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="56" fill="url(#gtg)" opacity="0.18" />
                <path
                  d="M40 70c0-7 6-13 13-13h14c7 0 13 6 13 13v8H40v-8Z"
                  fill="#1d9bf0"
                  opacity="0.85"
                />
                <circle cx="60" cy="46" r="10" fill="#1d9bf0" opacity="0.85" />
                <defs>
                  <linearGradient id="gtg" x1="0" y1="0" x2="120" y2="120">
                    <stop stopColor="#1d9bf0" />
                    <stop offset="1" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <p className="gt-empty-text">
              {search
                ? t("group.noSearchResults")
                : t("group.noJoinedGroups")}
            </p>
          </div>
        ) : (
          <div className="gt-grid gt-grid--compact">
            {filteredMy.map((g) => (
              <Link
                key={g.id}
                to={`/groups/${g.id}`}
                className="gt-mini-card"
              >
                <div
                  className="gt-mini-cover"
                  style={
                    g.image
                      ? { backgroundImage: `url(${g.image})` }
                      : undefined
                  }
                >
                  {!g.image && (
                    <span className="gt-mini-letter">
                      {g.name?.[0]?.toUpperCase() || "G"}
                    </span>
                  )}
                </div>
                <div className="gt-mini-body">
                  <div className="gt-mini-name">
                    <span className="gt-mini-name-text">{g.name}</span>
                    {g.organizationId && (
                      <VerifiedBadge
                        size="sm"
                        title={t("group.officialBadge")}
                      />
                    )}
                  </div>
                  <div className="gt-mini-meta">
                    {g.members} {t("group.members")}
                  </div>
                </div>
                <span className="gt-mini-arrow" aria-hidden>
                  →
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Suggested — full cover cards */}
      <section className="gt-section">
        <header className="gt-section-head">
          <h2 className="gt-section-title">{t("group.suggestedGroups")}</h2>
          <p className="gt-section-sub">{t("group.suggestedSubtitle")}</p>
        </header>

        {loading ? (
          <div className="gt-grid gt-grid--cards">
            {Array.from({ length: 4 }).map((_, i) => (
              <GroupCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredSuggested.length === 0 ? (
          <div className="gt-empty">
            <p className="gt-empty-text">
              {search
                ? t("group.noSearchResults")
                : t("group.noSuggestions")}
            </p>
          </div>
        ) : (
          <div className="gt-grid gt-grid--cards">
            {filteredSuggested.map((g) => (
              <article
                key={g.id}
                className="gt-card"
                onClick={() => navigate(`/groups/${g.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/groups/${g.id}`);
                }}
              >
                <div
                  className="gt-card-cover"
                  style={{
                    backgroundImage: `url(${g.image || FALLBACK_COVER})`,
                  }}
                />
                <div className="gt-card-body">
                  <h3 className="gt-card-name">
                    <span className="gt-card-name-text">{g.name}</span>
                    {g.organizationId && (
                      <VerifiedBadge
                        size="sm"
                        title={t("group.officialBadge")}
                      />
                    )}
                  </h3>
                  {g.description && (
                    <p className="gt-card-desc">{g.description}</p>
                  )}
                  <div className="gt-card-footer">
                    <span className="gt-card-members">
                      {g.members} {t("group.members")}
                    </span>
                    <button
                      type="button"
                      className="gt-card-join"
                      onClick={(e) => handleJoinGroup(e, g.id)}
                      disabled={joiningGroupId === g.id}
                    >
                      {joiningGroupId === g.id
                        ? t("group.joining")
                        : t("group.join")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <CreateGroupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
}

export default GroupsTab;
