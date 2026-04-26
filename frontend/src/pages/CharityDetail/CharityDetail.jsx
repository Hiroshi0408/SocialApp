/* global BigInt */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import MilestoneList from "../../components/MilestoneList/MilestoneList";
import DonateModal from "../../components/DonateModal/DonateModal";
import ClaimRefundModal from "../../components/ClaimRefundModal/ClaimRefundModal";
import { charityService } from "../../api";
import { useWeb3 } from "../../contexts/Web3Context";
import { showError, showSuccess } from "../../utils/toast";
import { SEPOLIA_ETHERSCAN_BASE, DEFAULT_IMAGES } from "../../constants";
import "./CharityDetail.css";

const CHARITY_ADDRESS = process.env.REACT_APP_CHARITY_ADDRESS || "";

// Cùng convention với CampaignCard (xem CLAUDE.md — dùng BigInt cho percent).
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

const computeProgress = (raisedWei, goalWei) => {
  try {
    const raised = BigInt(raisedWei || "0");
    const goal = BigInt(goalWei || "0");
    if (goal === 0n) return 0;
    const pct = Number((raised * 10000n) / goal) / 100;
    return Math.min(100, Math.max(0, pct));
  } catch {
    return 0;
  }
};

// Rút ngắn ví / hash hiển thị: 0xabcd…1234
const shortenAddress = (addr) => {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

const formatTimeLeft = (deadline, t) => {
  if (!deadline) return "";
  const diffMs = new Date(deadline).getTime() - Date.now();
  if (diffMs <= 0) return t("charity.ended");
  const hours = Math.floor(diffMs / 36e5);
  if (hours < 48) return t("charity.hoursLeft", { count: Math.max(1, hours) });
  return t("charity.daysLeft", { count: Math.floor(hours / 24) });
};

function DetailSkeleton() {
  return (
    <div className="charity-detail-skeleton" aria-hidden>
      <div className="charity-detail-skeleton-cover" />
      <div className="charity-detail-skeleton-row" />
      <div className="charity-detail-skeleton-row charity-detail-skeleton-row--short" />
      <div className="charity-detail-skeleton-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="charity-detail-skeleton-stat" />
        ))}
      </div>
      <div className="charity-detail-skeleton-row" />
      <div className="charity-detail-skeleton-row" />
      <div className="charity-detail-skeleton-row charity-detail-skeleton-row--short" />
    </div>
  );
}

function CharityDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { walletAddress } = useWeb3();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [donations, setDonations] = useState([]);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [donateModalOpen, setDonateModalOpen] = useState(false);
  const [claimRefundModalOpen, setClaimRefundModalOpen] = useState(false);

  const fetchDetail = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoading(true);
        const data = await charityService.getCampaignDetail(id);
        setCampaign(data.campaign);
        setError(null);
      } catch (err) {
        setError(err);
        if (!silent) showError(t("charity.detail.loadFailed"));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, t]
  );

  const fetchDonations = useCallback(async () => {
    try {
      setDonationsLoading(true);
      const data = await charityService.listDonations(id, { page: 1, limit: 10 });
      setDonations(data.donations || []);
    } catch {
      setDonations([]);
    } finally {
      setDonationsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    fetchDonations();
  }, [fetchDetail, fetchDonations]);

  // Force sync — server đọc on-chain ghi đè cache Mongo, trả về { onChain, cache, synced }
  // (cache là snapshot TRƯỚC khi ghi đè). So sánh on-chain vs cache để biết match/diff,
  // rồi refetch detail để hiển thị state mới nhất.
  const handleSync = useCallback(async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const data = await charityService.syncFromChain(id);
      const matched =
        data.onChain &&
        data.cache &&
        data.onChain.raisedWei === data.cache.raisedWei &&
        data.onChain.unlockedTotalWei === data.cache.unlockedTotalWei &&
        data.onChain.status === data.cache.status;

      await fetchDetail({ silent: true });
      setSyncResult({ matched, syncedAt: Date.now() });
      if (matched) showSuccess(t("charity.transparency.match"));
      else showSuccess(t("charity.transparency.mismatch"));
    } catch {
      showError(t("charity.transparency.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }, [id, syncing, fetchDetail, t]);

  const stats = useMemo(() => {
    if (!campaign) return null;
    return {
      raised: formatEth(campaign.raisedWei),
      goal: formatEth(campaign.goalWei),
      unlocked: formatEth(campaign.unlockedTotalWei),
      progress: computeProgress(campaign.raisedWei, campaign.goalWei),
      timeLeft: formatTimeLeft(campaign.deadline, t),
    };
  }, [campaign, t]);

  if (loading) {
    return (
      <div className="charity-detail-page">
        <Sidebar />
        <div className="charity-detail-wrapper">
          <Header />
          <main className="charity-detail-main">
            <DetailSkeleton />
          </main>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="charity-detail-page">
        <Sidebar />
        <div className="charity-detail-wrapper">
          <Header />
          <main className="charity-detail-main">
            <div className="charity-detail-error">
              <h2>{t("charity.detail.notFoundTitle")}</h2>
              <p>{t("charity.detail.notFoundDescription")}</p>
              <Link to="/charity" className="charity-detail-back">
                {t("charity.detail.backToList")}
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const org = campaign.organization;
  const status = campaign.status || "OPEN";
  const canDonate = status === "OPEN";
  // FAILED + wallet connected → cho phép thử claim (modal tự check contribution > 0)
  const canClaimRefund = status === "FAILED" && !!walletAddress;

  return (
    <div className="charity-detail-page">
      <Sidebar />
      <div className="charity-detail-wrapper">
        <Header />
        <main className="charity-detail-main">
          <Link to="/charity" className="charity-detail-back-link">
            ← {t("charity.detail.backToList")}
          </Link>

          {/* ─── Hero ─── */}
          <section className="charity-detail-hero">
            <div className="charity-detail-cover">
              {campaign.coverImage ? (
                <img src={campaign.coverImage} alt={campaign.title} />
              ) : (
                <div className="charity-detail-cover-placeholder" />
              )}
              <span
                className={`charity-detail-status charity-detail-status--${status}`}
              >
                {t(`charity.status.${status}`)}
              </span>
            </div>

            <div className="charity-detail-headline">
              <h1 className="charity-detail-title">{campaign.title}</h1>
              {org ? (
                <Link
                  to={`/org/${org.slug}`}
                  className="charity-detail-org"
                >
                  {org.logo ? (
                    <img
                      src={org.logo}
                      alt={org.name}
                      className="charity-detail-org-logo"
                      onError={(e) => {
                        e.currentTarget.src = DEFAULT_IMAGES.AVATAR;
                      }}
                    />
                  ) : (
                    <span className="charity-detail-org-logo charity-detail-org-logo--placeholder" />
                  )}
                  <span className="charity-detail-org-name">
                    {org.name}
                    {org.status === "verified" && <VerifiedBadge size="sm" />}
                  </span>
                </Link>
              ) : (
                <span className="charity-detail-org charity-detail-org--anon">
                  {t("charity.anonymousOrg")}
                </span>
              )}
            </div>
          </section>

          {/* ─── Stats + progress ─── */}
          <section className="charity-detail-stats-card">
            <div className="charity-detail-progress">
              <div className="charity-detail-progress-bar">
                <div
                  className="charity-detail-progress-fill"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
              <div className="charity-detail-progress-meta">
                <span className="charity-detail-progress-raised">
                  {t("charity.raisedOf", {
                    raised: stats.raised,
                    goal: stats.goal,
                  })}
                </span>
                <span className="charity-detail-progress-pct">
                  {stats.progress.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="charity-detail-stats">
              <div className="charity-detail-stat">
                <span className="charity-detail-stat-value">
                  {campaign.donorsCount || 0}
                </span>
                <span className="charity-detail-stat-label">
                  {t("charity.detail.donorsLabel")}
                </span>
              </div>
              <div className="charity-detail-stat">
                <span className="charity-detail-stat-value">
                  {stats.timeLeft || "—"}
                </span>
                <span className="charity-detail-stat-label">
                  {t("charity.detail.deadlineLabel")}
                </span>
              </div>
              <div className="charity-detail-stat">
                <span className="charity-detail-stat-value">
                  {stats.unlocked} ETH
                </span>
                <span className="charity-detail-stat-label">
                  {t("charity.detail.unlockedLabel")}
                </span>
              </div>
              <div className="charity-detail-stat">
                <span className="charity-detail-stat-value">
                  {campaign.milestones?.length || 0}
                </span>
                <span className="charity-detail-stat-label">
                  {t("charity.detail.milestonesLabel")}
                </span>
              </div>
            </div>

            <div className="charity-detail-actions">
              {canDonate && (
                <button
                  type="button"
                  className="charity-detail-donate-btn"
                  onClick={() => setDonateModalOpen(true)}
                >
                  {t("charity.donate.cta")}
                </button>
              )}

              {status === "FAILED" && (
                <button
                  type="button"
                  className="charity-detail-claim-refund-btn"
                  onClick={() =>
                    walletAddress
                      ? setClaimRefundModalOpen(true)
                      : setClaimRefundModalOpen(true) // modal tự xử lý case chưa connect
                  }
                >
                  {t("charity.claimRefund.cta")}
                </button>
              )}

              {!canDonate && status !== "FAILED" && (
                <p className="charity-detail-actions-note">
                  {t(`charity.detail.notDonatable.${status}`)}
                </p>
              )}
            </div>
          </section>

          {/* ─── Description ─── */}
          {campaign.description && (
            <section className="charity-detail-section">
              <h2 className="charity-detail-section-title">
                {t("charity.detail.aboutTitle")}
              </h2>
              <div className="charity-detail-description">
                {campaign.description}
              </div>
            </section>
          )}

          {/* ─── Milestones ─── */}
          <section className="charity-detail-section">
            <h2 className="charity-detail-section-title">
              {t("charity.detail.milestonesTitle")}
            </h2>
            <p className="charity-detail-section-subtitle">
              {t("charity.detail.milestonesSubtitle")}
            </p>
            <MilestoneList milestones={campaign.milestones} />
          </section>

          {/* ─── Latest donors ─── */}
          <section className="charity-detail-section">
            <h2 className="charity-detail-section-title">
              {t("charity.detail.latestDonorsTitle")}
            </h2>
            {donationsLoading ? (
              <div className="charity-detail-donor-list-loading">
                {t("charity.detail.loading")}
              </div>
            ) : donations.length === 0 ? (
              <p className="charity-detail-donor-empty">
                {t("charity.detail.noDonationsYet")}
              </p>
            ) : (
              <ul className="charity-detail-donor-list">
                {donations.map((d) => (
                  <li key={d.id} className="charity-detail-donor-row">
                    <div className="charity-detail-donor-identity">
                      {d.donorUser ? (
                        <Link
                          to={`/profile/${d.donorUser.username}`}
                          className="charity-detail-donor-link"
                        >
                          <img
                            src={d.donorUser.avatar || DEFAULT_IMAGES.AVATAR}
                            alt={d.donorUser.username}
                            className="charity-detail-donor-avatar"
                            onError={(e) => {
                              e.currentTarget.src = DEFAULT_IMAGES.AVATAR;
                            }}
                          />
                          <span className="charity-detail-donor-name">
                            {d.donorUser.fullName || d.donorUser.username}
                          </span>
                        </Link>
                      ) : (
                        <span className="charity-detail-donor-anon">
                          <span className="charity-detail-donor-avatar charity-detail-donor-avatar--placeholder" />
                          <span className="charity-detail-donor-wallet">
                            {shortenAddress(d.donor)}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="charity-detail-donor-meta">
                      <span className="charity-detail-donor-amount">
                        {formatEth(d.amountWei)} ETH
                      </span>
                      <a
                        href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${d.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="charity-detail-donor-tx"
                      >
                        {t("charity.detail.viewTx")}
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ─── Transparency panel ─── */}
          <section className="charity-detail-section charity-detail-transparency">
            <h2 className="charity-detail-section-title">
              {t("charity.transparency.title")}
            </h2>
            <p className="charity-detail-section-subtitle">
              {t("charity.transparency.subtitle")}
            </p>

            <div className="charity-detail-transparency-grid">
              {CHARITY_ADDRESS && (
                <div className="charity-detail-transparency-item">
                  <span className="charity-detail-transparency-label">
                    {t("charity.transparency.contract")}
                  </span>
                  <a
                    href={`${SEPOLIA_ETHERSCAN_BASE}/address/${CHARITY_ADDRESS}`}
                    target="_blank"
                    rel="noreferrer"
                    className="charity-detail-transparency-link"
                  >
                    {shortenAddress(CHARITY_ADDRESS)} ↗
                  </a>
                </div>
              )}

              {campaign.beneficiary && (
                <div className="charity-detail-transparency-item">
                  <span className="charity-detail-transparency-label">
                    {t("charity.transparency.beneficiary")}
                  </span>
                  <a
                    href={`${SEPOLIA_ETHERSCAN_BASE}/address/${campaign.beneficiary}`}
                    target="_blank"
                    rel="noreferrer"
                    className="charity-detail-transparency-link"
                  >
                    {shortenAddress(campaign.beneficiary)} ↗
                  </a>
                </div>
              )}

              {campaign.createTxHash && (
                <div className="charity-detail-transparency-item">
                  <span className="charity-detail-transparency-label">
                    {t("charity.transparency.createTx")}
                  </span>
                  <a
                    href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${campaign.createTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="charity-detail-transparency-link"
                  >
                    {shortenAddress(campaign.createTxHash)} ↗
                  </a>
                </div>
              )}

              {typeof campaign.onChainId === "number" && (
                <div className="charity-detail-transparency-item">
                  <span className="charity-detail-transparency-label">
                    {t("charity.transparency.onChainId")}
                  </span>
                  <span className="charity-detail-transparency-value">
                    #{campaign.onChainId}
                  </span>
                </div>
              )}
            </div>

            <div className="charity-detail-verify">
              <button
                type="button"
                className="charity-detail-verify-btn"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing
                  ? t("charity.transparency.verifying")
                  : t("charity.transparency.verifyButton")}
              </button>
              {syncResult && (
                <span
                  className={`charity-detail-verify-result charity-detail-verify-result--${
                    syncResult.matched ? "ok" : "diff"
                  }`}
                >
                  {syncResult.matched
                    ? t("charity.transparency.match")
                    : t("charity.transparency.mismatch")}
                </span>
              )}
            </div>
          </section>
        </main>
      </div>

      <DonateModal
        isOpen={donateModalOpen}
        onClose={() => setDonateModalOpen(false)}
        campaign={campaign}
        onSuccess={() => {
          showSuccess(t("charity.donate.successToast", { amount: "" }).trim());
          fetchDetail({ silent: true });
          fetchDonations();
        }}
      />

      <ClaimRefundModal
        isOpen={claimRefundModalOpen}
        onClose={() => setClaimRefundModalOpen(false)}
        campaign={campaign}
        onSuccess={() => {
          showSuccess(t("charity.claimRefund.successToast"));
          fetchDetail({ silent: true });
          fetchDonations();
        }}
      />
    </div>
  );
}

export default CharityDetail;
