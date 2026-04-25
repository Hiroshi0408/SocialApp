/* global BigInt */
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";
import VerifiedBadge from "../VerifiedBadge/VerifiedBadge";
import "./CampaignCard.css";

// raisedWei / goalWei là String BigInt (xem CLAUDE.md — race + sai số nếu parseInt).
// Dùng ethers.formatEther để hiển thị, BigInt để tính phần trăm.
const formatEth = (wei) => {
  if (!wei) return "0";
  try {
    const formatted = ethers.formatEther(wei);
    const num = parseFloat(formatted);
    if (Number.isNaN(num)) return "0";
    // 4 chữ số thập phân là đủ — testnet ETH thường nhỏ
    return num.toLocaleString(undefined, {
      maximumFractionDigits: 4,
      minimumFractionDigits: 0,
    });
  } catch {
    return "0";
  }
};

const computeProgress = (raisedWei, goalWei) => {
  try {
    const raised = BigInt(raisedWei || "0");
    const goal = BigInt(goalWei || "0");
    if (goal === 0n) return 0;
    // Nhân 10000 trước khi chia để giữ 2 số thập phân
    const pct = Number((raised * 10000n) / goal) / 100;
    return Math.min(100, Math.max(0, pct));
  } catch {
    return 0;
  }
};

function CampaignCard({ campaign }) {
  const { t } = useTranslation();

  const { raised, goal, progress, timeLabel } = useMemo(() => {
    const raisedStr = formatEth(campaign.raisedWei);
    const goalStr = formatEth(campaign.goalWei);
    const pct = computeProgress(campaign.raisedWei, campaign.goalWei);

    let label = "";
    if (campaign.deadline) {
      const diffMs = new Date(campaign.deadline).getTime() - Date.now();
      if (diffMs <= 0) {
        label = t("charity.ended");
      } else {
        const hours = Math.floor(diffMs / 36e5);
        if (hours < 48) {
          label = t("charity.hoursLeft", { count: Math.max(1, hours) });
        } else {
          const days = Math.floor(hours / 24);
          label = t("charity.daysLeft", { count: days });
        }
      }
    }

    return { raised: raisedStr, goal: goalStr, progress: pct, timeLabel: label };
  }, [campaign.raisedWei, campaign.goalWei, campaign.deadline, t]);

  if (!campaign) return null;

  const org = campaign.organization;
  const statusKey = campaign.status || "OPEN";
  const milestonesCount = campaign.milestones?.length || 0;

  return (
    <Link to={`/charity/${campaign.id}`} className="campaign-card">
      <div className="campaign-card-cover">
        {campaign.coverImage ? (
          <img src={campaign.coverImage} alt={campaign.title} loading="lazy" />
        ) : (
          <div className="campaign-card-cover-placeholder" />
        )}
        <span className={`campaign-card-status campaign-card-status--${statusKey}`}>
          {t(`charity.status.${statusKey}`)}
        </span>
      </div>

      <div className="campaign-card-body">
        <h3 className="campaign-card-title">{campaign.title}</h3>

        <div className="campaign-card-org">
          <span className="campaign-card-by">{t("charity.by")}</span>
          {org ? (
            <span className="campaign-card-org-name">
              {org.name}
              {org.status === "verified" && <VerifiedBadge size="sm" />}
            </span>
          ) : (
            <span className="campaign-card-org-name campaign-card-org-name--anon">
              {t("charity.anonymousOrg")}
            </span>
          )}
        </div>

        <div className="campaign-card-progress-wrapper">
          <div className="campaign-card-progress-bar">
            <div
              className="campaign-card-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="campaign-card-progress-meta">
            <span className="campaign-card-raised">
              {t("charity.raisedOf", { raised, goal })}
            </span>
            <span className="campaign-card-progress-pct">
              {progress.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="campaign-card-stats">
          <span>{t("charity.donors", { count: campaign.donorsCount || 0 })}</span>
          {milestonesCount > 0 && (
            <span>·</span>
          )}
          {milestonesCount > 0 && (
            <span>
              {t("charity.milestonesCount", { count: milestonesCount })}
            </span>
          )}
          {timeLabel && (
            <>
              <span>·</span>
              <span className="campaign-card-time">{timeLabel}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

export default CampaignCard;
