import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import OrganizationCard from "../../components/OrganizationCard/OrganizationCard";
import { organizationService } from "../../api";
import { showError } from "../../utils/toast";
import "./OrganizationsTab.css";

const CATEGORIES = [
  "education",
  "disaster-relief",
  "health",
  "environment",
  "animal",
];

function OrgCardSkeleton() {
  return (
    <div className="ot-skeleton" aria-hidden>
      <div className="ot-skeleton-cover" />
      <div className="ot-skeleton-body">
        <div className="ot-skeleton-logo" />
        <div className="ot-skeleton-lines">
          <div className="ot-skeleton-line ot-skeleton-line--title" />
          <div className="ot-skeleton-line ot-skeleton-line--short" />
        </div>
      </div>
    </div>
  );
}

function OrganizationsTab() {
  const { t } = useTranslation();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      const res = await organizationService.list(params);
      if (res?.success) setOrganizations(res.organizations || []);
    } catch {
      showError(t("organizations.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, category, t]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <div className="ot-root">
      {/* Toolbar: search + filter + apply */}
      <div className="ot-toolbar">
        <div className="ot-search-wrap">
          <svg
            className="ot-search-icon"
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
            className="ot-search-input"
            placeholder={t("organizations.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="ot-filter-select"
          aria-label={t("organizations.allCategories")}
        >
          <option value="">{t("organizations.allCategories")}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`organizations.category.${c}`)}
            </option>
          ))}
        </select>

        <Link to="/organizations/apply" className="ot-apply-btn">
          {t("organizations.applyCta")}
        </Link>
      </div>

      {loading ? (
        <div className="ot-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <OrgCardSkeleton key={i} />
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <div className="ot-empty">
          <div className="ot-empty-illustration" aria-hidden>
            <svg viewBox="0 0 120 120" fill="none">
              <circle
                cx="60"
                cy="60"
                r="56"
                fill="url(#otg)"
                opacity="0.18"
              />
              <path
                d="M60 28 36 38v18c0 15 10.5 28 24 30 13.5-2 24-15 24-30V38L60 28Z"
                fill="#10b981"
                opacity="0.85"
              />
              <path
                d="m51 60 6 6 12-12"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="otg" x1="0" y1="0" x2="120" y2="120">
                  <stop stopColor="#1d9bf0" />
                  <stop offset="1" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3 className="ot-empty-title">{t("organizations.empty.title")}</h3>
          <p className="ot-empty-text">
            {t("organizations.empty.description")}
          </p>
          <Link to="/organizations/apply" className="ot-empty-cta">
            {t("organizations.applyCta")}
          </Link>
        </div>
      ) : (
        <div className="ot-grid">
          {organizations.map((org) => (
            <OrganizationCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}

export default OrganizationsTab;
