import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { organizationService } from "../../api";
import { showError } from "../../utils/toast";
import "./MyOrganization.css";

const STATUS_COPY = {
  pending: {
    title: "Pending review",
    body: "Your application is being reviewed by admin. You will be notified when a decision is made.",
    className: "status-pending",
  },
  verified: {
    title: "Verified",
    body: "Your organization is verified. Your wallet is whitelisted for charity campaigns.",
    className: "status-verified",
  },
  rejected: {
    title: "Rejected",
    body: "Unfortunately your application was not approved. You can apply again with updated information.",
    className: "status-rejected",
  },
};

function MyOrganization() {
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchMine() {
      try {
        setLoading(true);
        const res = await organizationService.getMine();
        if (mounted && res?.success) setOrg(res.organization);
      } catch (err) {
        showError(err?.response?.data?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchMine();
    return () => {
      mounted = false;
    };
  }, []);

  const status = org?.status;
  const statusInfo = status ? STATUS_COPY[status] : null;

  return (
    <div className="my-org-page">
      <Sidebar />
      <div className="my-org-wrapper">
        <Header />
        <main className="my-org-main">
          <h1>My Organization</h1>

          {loading && <p className="my-org-empty">Loading...</p>}

          {!loading && !org && (
            <div className="my-org-empty-state">
              <p>You don't have an organization yet.</p>
              <Link to="/organizations/apply" className="btn-apply-now">
                Apply now
              </Link>
            </div>
          )}

          {org && statusInfo && (
            <>
              <div className={`my-org-status ${statusInfo.className}`}>
                <h3>{statusInfo.title}</h3>
                <p>{statusInfo.body}</p>
                {status === "rejected" && org.rejectedReason && (
                  <p className="my-org-reject-reason">
                    Reason: {org.rejectedReason}
                  </p>
                )}
              </div>

              <div className="my-org-summary">
                <div className="my-org-row">
                  <span className="my-org-label">Name</span>
                  <span>
                    {org.name}
                    {status === "verified" && (
                      <>
                        {" "}
                        <VerifiedBadge verifiedAt={org.verifiedAt} size="sm" />
                      </>
                    )}
                  </span>
                </div>
                <div className="my-org-row">
                  <span className="my-org-label">Wallet</span>
                  <code>{org.walletAddress}</code>
                </div>
                {org.contactEmail && (
                  <div className="my-org-row">
                    <span className="my-org-label">Email</span>
                    <span>{org.contactEmail}</span>
                  </div>
                )}
                {org.website && (
                  <div className="my-org-row">
                    <span className="my-org-label">Website</span>
                    <span>{org.website}</span>
                  </div>
                )}
              </div>

              <div className="my-org-actions">
                <Link to={`/org/${org.slug}`} className="btn-view-public">
                  View public page
                </Link>
                {status === "verified" && (
                  <button
                    className="btn-create-campaign"
                    disabled
                    title="Available when Charity contract is deployed"
                  >
                    Create campaign (soon)
                  </button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default MyOrganization;
