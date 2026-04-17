import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import web3Service from "../../api/web3Service";
import "./VerifyPost.css";

function VerifyPost() {
  const { postId } = useParams();
  const { t } = useTranslation();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    web3Service
      .verifyPost(postId)
      .then((data) => setResult(data))
      .catch((err) => {
        const msg = err.response?.data?.message || t("verifyPost.unknownError");
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [postId, t]);

  return (
    <div className="verify-post-page">
      <div className="verify-post-card">
        <div className="verify-post-header">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
          </svg>
          <h1>{t("verifyPost.title")}</h1>
        </div>

        <p className="verify-post-id">
          {t("verifyPost.postId")}: <code>{postId}</code>
        </p>

        {loading && (
          <div className="verify-loading">
            <div className="verify-spinner" />
            <p>{t("verifyPost.verifying")}</p>
          </div>
        )}

        {error && (
          <div className="verify-error-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <p>{error}</p>
          </div>
        )}

        {!loading && result && (
          <>
            <div className={`verify-result-badge ${result.match ? "match" : "mismatch"}`}>
              {result.match ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                  </svg>
                  {t("verifyPost.matchTitle")}
                </>
              ) : (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  {t("verifyPost.mismatchTitle")}
                </>
              )}
            </div>

            <p className="verify-result-desc">
              {result.match ? t("verifyPost.matchDesc") : t("verifyPost.mismatchDesc")}
            </p>

            <div className="verify-hash-section">
              <div className="verify-hash-row">
                <span className="verify-hash-label">{t("verifyPost.onChainHash")}</span>
                <code className="verify-hash-value">{result.onChainData?.contentHash}</code>
              </div>
              <div className="verify-hash-row">
                <span className="verify-hash-label">{t("verifyPost.offChainHash")}</span>
                <code className={`verify-hash-value ${!result.match ? "hash-mismatch" : ""}`}>
                  {result.offChainHash}
                </code>
              </div>
            </div>

            <div className="verify-meta">
              <div className="verify-meta-row">
                <span>{t("verifyPost.registeredAt")}</span>
                <span>
                  {result.onChainData?.timestamp
                    ? new Date(result.onChainData.timestamp).toLocaleString()
                    : "-"}
                </span>
              </div>
              <div className="verify-meta-row">
                <span>{t("verifyPost.owner")}</span>
                <code>{result.onChainData?.owner}</code>
              </div>
            </div>

            <a
              href={`https://sepolia.etherscan.io/address/${result.onChainData?.owner}`}
              target="_blank"
              rel="noopener noreferrer"
              className="verify-etherscan-link"
            >
              {t("verifyPost.viewOnEtherscan")} ↗
            </a>
          </>
        )}

        <Link to="/" className="verify-back-link">{t("verifyPost.backToHome")}</Link>
      </div>
    </div>
  );
}

export default VerifyPost;
