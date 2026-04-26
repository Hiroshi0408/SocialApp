import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";
import { SEPOLIA_ETHERSCAN_BASE } from "../../constants";
import "./MilestoneList.css";

// amountWei lưu dạng String BigInt — ethers.formatEther parse an toàn.
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

const formatDateTime = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
};

function MilestoneList({ milestones }) {
  const { t } = useTranslation();

  if (!milestones || milestones.length === 0) {
    return (
      <div className="milestone-list-empty">
        {t("charity.detail.noMilestones")}
      </div>
    );
  }

  return (
    <ol className="milestone-list">
      {milestones.map((m) => {
        const idx = m.idx ?? 0;
        return (
          <li
            key={idx}
            className={`milestone-item milestone-item--${m.unlocked ? "unlocked" : "pending"}`}
          >
            <div className="milestone-marker" aria-hidden>
              {m.unlocked ? (
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path
                    d="M9 16.2l-3.5-3.5L4 14.2 9 19.2 20 8.2l-1.5-1.5z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <span className="milestone-marker-num">{idx + 1}</span>
              )}
            </div>

            <div className="milestone-body">
              <div className="milestone-head">
                <h4 className="milestone-title">
                  {m.title ||
                    t("charity.detail.milestoneFallbackTitle", {
                      idx: idx + 1,
                    })}
                </h4>
                <span className="milestone-amount">
                  {formatEth(m.amountWei)} ETH
                </span>
              </div>

              {m.description && (
                <p className="milestone-description">{m.description}</p>
              )}

              <div className="milestone-meta">
                <span
                  className={`milestone-status milestone-status--${m.unlocked ? "unlocked" : "pending"}`}
                >
                  {m.unlocked
                    ? t("charity.milestone.unlocked")
                    : t("charity.milestone.pending")}
                </span>

                {m.unlocked && m.unlockedAt && (
                  <span className="milestone-meta-item">
                    {formatDateTime(m.unlockedAt)}
                  </span>
                )}

                {m.unlocked && m.unlockedTxHash && (
                  <a
                    href={`${SEPOLIA_ETHERSCAN_BASE}/tx/${m.unlockedTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="milestone-meta-link"
                  >
                    {t("charity.detail.viewTx")}
                  </a>
                )}

                {m.unlocked && m.reportPostId && (
                  <Link
                    to={`/post/${m.reportPostId}`}
                    className="milestone-meta-link"
                  >
                    {t("charity.detail.viewReport")}
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default MilestoneList;
