import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import CampaignCard from "../../components/CampaignCard/CampaignCard";
import { organizationService, charityService } from "../../api";
import { showError } from "../../utils/toast";
import { SEPOLIA_ETHERSCAN_BASE } from "../../constants";
import "./OrganizationDetail.css";

const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

const formatEth = (wei) => {
  if (!wei) return "0";
  try {
    const n = parseFloat(ethers.formatEther(wei));
    if (Number.isNaN(n)) return "0";
    return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return "0";
  }
};

const formatRelDate = (d) => {
  if (!d) return "";
  try {
    const date = new Date(d);
    return date.toLocaleString();
  } catch {
    return "";
  }
};

function OrganizationDetail() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("about");

  // Campaigns + Updates dùng chung 1 nguồn data — list campaigns của org.
  // Updates flatten unlocked milestones từ cùng response, không cần API riêng.
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoaded, setCampaignsLoaded] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchDetail() {
      try {
        setLoading(true);
        const res = await organizationService.getBySlug(slug);
        if (mounted && res?.success) setOrg(res.organization);
      } catch (err) {
        showError(
          err?.response?.data?.message || "Failed to load organization"
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchDetail();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Lazy-load campaigns lần đầu user click Campaigns hoặc Updates.
  // Tránh fetch ngay khi vào trang nếu user chỉ đọc About.
  useEffect(() => {
    if (!org?.id) return;
    if (tab !== "campaigns" && tab !== "updates") return;
    if (campaignsLoaded || campaignsLoading) return;

    let mounted = true;
    async function fetchCampaigns() {
      try {
        setCampaignsLoading(true);
        // Lấy tối đa 50 campaign mới nhất — đủ cho phần Updates flatten.
        // Pagination thật không cần thiết vì 1 org rare khi có >50 campaign.
        const res = await charityService.listCampaigns({
          organizationId: org.id,
          limit: 50,
          sort: "newest",
        });
        if (mounted) {
          setCampaigns(res.campaigns || []);
          setCampaignsLoaded(true);
        }
      } catch (err) {
        showError(
          err?.response?.data?.message || "Failed to load campaigns"
        );
      } finally {
        if (mounted) setCampaignsLoading(false);
      }
    }
    fetchCampaigns();
    return () => {
      mounted = false;
    };
  }, [org?.id, tab, campaignsLoaded, campaignsLoading]);

  // Flatten các milestone đã unlocked thành 1 timeline duy nhất, sort theo
  // unlockedAt giảm dần. Mỗi entry kèm campaign context để render link tới
  // detail + tx Etherscan + post báo cáo.
  const updates = useMemo(() => {
    const items = [];
    for (const c of campaigns) {
      for (const m of c.milestones || []) {
        if (!m.unlocked) continue;
        items.push({
          campaignId: c.id,
          campaignTitle: c.title,
          milestoneIdx: m.idx ?? 0,
          milestoneTitle: m.title,
          milestoneDescription: m.description,
          amountWei: m.amountWei,
          unlockedAt: m.unlockedAt,
          unlockedTxHash: m.unlockedTxHash,
          reportPostId: m.reportPostId,
        });
      }
    }
    items.sort((a, b) => {
      const ta = a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0;
      const tb = b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0;
      return tb - ta;
    });
    return items;
  }, [campaigns]);

  return (
    <div className="org-detail-page">
      <Sidebar />
      <div className="org-detail-wrapper">
        <Header />
        <main className="org-detail-main">
          {loading && <p className="org-detail-empty">Loading...</p>}

          {!loading && !org && (
            <p className="org-detail-empty">Organization not found.</p>
          )}

          {org && (
            <>
              <section className="org-detail-hero">
                <div className="org-detail-cover">
                  {org.coverImage ? (
                    <img src={org.coverImage} alt="" />
                  ) : (
                    <div className="org-detail-cover-placeholder" />
                  )}
                </div>
                <div className="org-detail-top">
                  <div className="org-detail-logo">
                    {org.logo ? (
                      <img src={org.logo} alt={org.name} />
                    ) : (
                      <div className="org-detail-logo-fallback">
                        {org.name?.[0]?.toUpperCase() || "O"}
                      </div>
                    )}
                  </div>
                  <div className="org-detail-head">
                    <div className="org-detail-name">
                      <h1>{org.name}</h1>
                      {org.status === "verified" && (
                        <VerifiedBadge verifiedAt={org.verifiedAt} size="lg" />
                      )}
                      {org.status === "pending" && (
                        <span className="org-status-pill org-status-pending">
                          Pending review
                        </span>
                      )}
                      {org.status === "rejected" && (
                        <span className="org-status-pill org-status-rejected">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="org-detail-sub">
                      <span className="org-wallet">
                        Wallet: <code>{shortAddr(org.walletAddress)}</code>
                      </span>
                      {org.groupId && (
                        <Link
                          to={`/groups/${org.groupId}`}
                          className="org-official-group-link"
                        >
                          Official group chat →
                        </Link>
                      )}
                    </div>
                    {org.categories?.length > 0 && (
                      <div className="org-detail-tags">
                        {org.categories.map((c) => (
                          <span key={c} className="org-tag">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Donate button trước đây disable "soon" — Charity đã live, giờ
                      điều hướng qua tab Campaigns để user chọn campaign cụ thể. */}
                </div>
              </section>

              <nav className="org-detail-tabs">
                <button
                  className={tab === "about" ? "active" : ""}
                  onClick={() => setTab("about")}
                >
                  About
                </button>
                <button
                  className={tab === "campaigns" ? "active" : ""}
                  onClick={() => setTab("campaigns")}
                >
                  Campaigns ({org.campaignsCount || 0})
                </button>
                <button
                  className={tab === "updates" ? "active" : ""}
                  onClick={() => setTab("updates")}
                >
                  Updates
                </button>
              </nav>

              <section className="org-detail-body">
                {tab === "about" && (
                  <div className="org-about">
                    <h3>Description</h3>
                    <p>{org.description || "No description provided."}</p>

                    <h3>Contact</h3>
                    <ul className="org-meta-list">
                      {org.contactEmail && (
                        <li>
                          Email: <a href={`mailto:${org.contactEmail}`}>{org.contactEmail}</a>
                        </li>
                      )}
                      {org.website && (
                        <li>
                          Website:{" "}
                          <a
                            href={org.website}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {org.website}
                          </a>
                        </li>
                      )}
                      <li>Wallet: <code>{org.walletAddress}</code></li>
                    </ul>

                    {org.status === "verified" && (
                      <p className="org-verified-note">
                        Verified on {new Date(org.verifiedAt).toLocaleDateString()}. This
                        wallet is whitelisted for charity campaigns.
                      </p>
                    )}
                  </div>
                )}

                {tab === "campaigns" && (
                  <div className="org-campaigns">
                    {campaignsLoading && !campaignsLoaded ? (
                      <p className="org-placeholder">Loading campaigns...</p>
                    ) : campaigns.length === 0 ? (
                      <p className="org-placeholder">
                        This organization has not created any campaigns yet.
                      </p>
                    ) : (
                      <div className="org-campaigns-grid">
                        {campaigns.map((c) => (
                          <CampaignCard key={c.id} campaign={c} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "updates" && (
                  <div className="org-updates">
                    {campaignsLoading && !campaignsLoaded ? (
                      <p className="org-placeholder">Loading updates...</p>
                    ) : updates.length === 0 ? (
                      <p className="org-placeholder">
                        No milestone has been unlocked yet. Updates will appear
                        here when admin disburses funds for a milestone.
                      </p>
                    ) : (
                      <ul className="org-updates-list">
                        {updates.map((u) => (
                          <li
                            key={`${u.campaignId}-${u.milestoneIdx}`}
                            className="org-update-item"
                          >
                            <div className="org-update-dot" />
                            <div className="org-update-body">
                              <div className="org-update-title">
                                <Link to={`/charity/${u.campaignId}`}>
                                  {u.campaignTitle}
                                </Link>{" "}
                                <span className="org-update-muted">
                                  — Milestone #{u.milestoneIdx + 1}:
                                </span>{" "}
                                <b>{u.milestoneTitle}</b>
                              </div>
                              {u.milestoneDescription && (
                                <div className="org-update-desc">
                                  {u.milestoneDescription}
                                </div>
                              )}
                              <div className="org-update-meta">
                                <span className="org-update-amount">
                                  Disbursed {formatEth(u.amountWei)} ETH
                                </span>
                                <span className="org-update-sep">·</span>
                                <span>{formatRelDate(u.unlockedAt)}</span>
                                {u.unlockedTxHash && (
                                  <>
                                    <span className="org-update-sep">·</span>
                                    <a
                                      href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${u.unlockedTxHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="org-update-link"
                                    >
                                      View tx ↗
                                    </a>
                                  </>
                                )}
                                {u.reportPostId && (
                                  <>
                                    <span className="org-update-sep">·</span>
                                    <Link
                                      to={`/post/${u.reportPostId}`}
                                      className="org-update-link"
                                    >
                                      Report post →
                                    </Link>
                                  </>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default OrganizationDetail;
