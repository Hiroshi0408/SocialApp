import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { organizationService } from "../../api";
import { showError } from "../../utils/toast";
import "./OrganizationDetail.css";

const shortAddr = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

function OrganizationDetail() {
  const { slug } = useParams();
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("about");

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
                          to={`/groups`}
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
                  <div className="org-detail-actions">
                    <button
                      className="btn-donate"
                      disabled
                      title="Will be enabled when Charity contract is deployed"
                    >
                      Donate (soon)
                    </button>
                  </div>
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
                  <div className="org-placeholder">
                    Charity campaigns will appear here once the Charity contract
                    is deployed.
                  </div>
                )}

                {tab === "updates" && (
                  <div className="org-placeholder">
                    Milestone updates will appear here.
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
