import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import CampaignCard from "../../components/CampaignCard/CampaignCard";
import { charityService } from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import { showError } from "../../utils/toast";
import "./Charity.css";

const STATUS_TABS = ["all", "OPEN", "FUNDED", "EXECUTING", "COMPLETED", "FAILED"];
const CATEGORIES = ["education", "medical", "disaster", "animal", "other"];
const SORT_OPTIONS = ["newest", "ending-soon", "most-funded"];

function CampaignSkeleton() {
  return (
    <div className="campaign-skeleton" aria-hidden>
      <div className="campaign-skeleton-cover" />
      <div className="campaign-skeleton-body">
        <div className="campaign-skeleton-line campaign-skeleton-line--title" />
        <div className="campaign-skeleton-line campaign-skeleton-line--short" />
        <div className="campaign-skeleton-bar" />
        <div className="campaign-skeleton-line campaign-skeleton-line--short" />
      </div>
    </div>
  );
}

function Charity() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [statusTab, setStatusTab] = useState("all");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");

  const [campaigns, setCampaigns] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const observerTarget = useRef(null);

  const fetchCampaigns = useCallback(
    async (pageNum, isLoadMore = false) => {
      try {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        const params = { page: pageNum, sort };
        if (statusTab !== "all") params.status = statusTab;
        if (category) params.category = category;

        const data = await charityService.listCampaigns(params);
        const items = data.campaigns || [];
        const totalPages = data.pagination?.totalPages || 1;
        const reachedEnd = pageNum >= totalPages || items.length === 0;

        setCampaigns((prev) => (isLoadMore ? [...prev, ...items] : items));
        setHasMore(!reachedEnd);
        setError(null);
      } catch (err) {
        setError(err);
        if (!isLoadMore) {
          setCampaigns([]);
          showError(t("charity.loadFailed"));
        }
      } finally {
        if (isLoadMore) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [statusTab, category, sort, t]
  );

  // Mỗi khi filter đổi → reset list về trang 1
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchCampaigns(1, false);
  }, [statusTab, category, sort, fetchCampaigns]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchCampaigns(nextPage, true);
    }
  }, [page, loadingMore, hasMore, loading, fetchCampaigns]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );
    const node = observerTarget.current;
    if (node) observer.observe(node);
    return () => {
      if (node) observer.unobserve(node);
    };
  }, [loadMore]);

  const emptyCta = useMemo(() => {
    if (!user) {
      return {
        to: "/organizations/apply",
        label: t("charity.empty.ctaGuest"),
      };
    }
    return {
      to: "/charity/create",
      label: t("charity.empty.cta"),
    };
  }, [user, t]);

  return (
    <div className="charity-page">
      <Sidebar />
      <div className="charity-wrapper">
        <Header />
        <main className="charity-main">
          <header className="charity-header">
            <div>
              <h1>{t("charity.title")}</h1>
              <p className="charity-subtitle">{t("charity.subtitle")}</p>
            </div>
            {user && (
              <Link to="/charity/create" className="charity-cta-primary">
                {t("charity.createCampaign")}
              </Link>
            )}
          </header>

          <div className="charity-tabs" role="tablist">
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={statusTab === s}
                className={`charity-tab ${statusTab === s ? "active" : ""}`}
                onClick={() => setStatusTab(s)}
              >
                {s === "all"
                  ? t("charity.filters.allStatus")
                  : t(`charity.status.${s}`)}
              </button>
            ))}
          </div>

          <div className="charity-filters">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="charity-filter-select"
              aria-label={t("charity.filters.allCategories")}
            >
              <option value="">{t("charity.filters.allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`charity.category.${c}`)}
                </option>
              ))}
            </select>

            <label className="charity-sort">
              <span className="charity-sort-label">
                {t("charity.filters.sortLabel")}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="charity-filter-select"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(
                      `charity.filters.sort${
                        s === "newest"
                          ? "Newest"
                          : s === "ending-soon"
                          ? "EndingSoon"
                          : "MostFunded"
                      }`
                    )}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="charity-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <CampaignSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="charity-error">
              <p>{t("charity.loadFailed")}</p>
              <button
                className="charity-retry"
                onClick={() => fetchCampaigns(1, false)}
              >
                {t("feed.retry")}
              </button>
            </div>
          ) : campaigns.length === 0 ? (
            <div className="charity-empty">
              <div className="charity-empty-illustration" aria-hidden>
                <svg viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="56" fill="url(#g)" opacity="0.18" />
                  <path
                    d="M60 86c-1.4 0-2.7-.5-3.7-1.5L36.5 65.6a13.5 13.5 0 0 1 0-19.1c5.3-5.3 13.8-5.3 19.1 0L60 50.9l4.4-4.4a13.5 13.5 0 0 1 19.1 0 13.5 13.5 0 0 1 0 19.1L63.7 84.5c-1 1-2.3 1.5-3.7 1.5Z"
                    fill="#1d9bf0"
                    opacity="0.85"
                  />
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="120" y2="120">
                      <stop stopColor="#1d9bf0" />
                      <stop offset="1" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h3>{t("charity.empty.title")}</h3>
              <p>{t("charity.empty.description")}</p>
              <Link to={emptyCta.to} className="charity-empty-cta">
                {emptyCta.label}
              </Link>
            </div>
          ) : (
            <>
              <div className="charity-grid">
                {campaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>

              {hasMore && (
                <div ref={observerTarget} className="charity-load-more">
                  {loadingMore && (
                    <div className="charity-grid charity-grid--inline">
                      <CampaignSkeleton />
                      <CampaignSkeleton />
                      <CampaignSkeleton />
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default Charity;
