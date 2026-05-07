import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import VerifiedBadge from "../../components/VerifiedBadge/VerifiedBadge";
import { organizationService } from "../../api";
import { showError } from "../../utils/toast";
import "./MyOrganization.css";

function MyOrganization() {
  const { t } = useTranslation();
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
        showError(err?.response?.data?.message || t("organizations.mine.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchMine();
    return () => {
      mounted = false;
    };
  }, [t]);

  const status = org?.status;
  const STATUS_COPY = {
    pending: {
      title: t("organizations.mine.status.pendingTitle"),
      body: t("organizations.mine.status.pendingBody"),
      className: "status-pending",
    },
    verified: {
      title: t("organizations.mine.status.verifiedTitle"),
      body: t("organizations.mine.status.verifiedBody"),
      className: "status-verified",
    },
    rejected: {
      title: t("organizations.mine.status.rejectedTitle"),
      body: t("organizations.mine.status.rejectedBody"),
      className: "status-rejected",
    },
  };
  const statusInfo = status ? STATUS_COPY[status] : null;

  return (
    <div className="my-org-page">
      <Sidebar />
      <div className="my-org-wrapper">
        <Header />
        <main className="my-org-main">
          <h1>{t("organizations.mine.title")}</h1>

          {loading && <p className="my-org-empty">{t("organizations.mine.loading")}</p>}

          {!loading && !org && (
            <div className="my-org-empty-state">
              <p>{t("organizations.mine.emptyText")}</p>
              <Link to="/organizations/apply" className="btn-apply-now">
                {t("organizations.mine.applyNow")}
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
                    {t("organizations.mine.rejectReason", { reason: org.rejectedReason })}
                  </p>
                )}
              </div>

              <div className="my-org-summary">
                <div className="my-org-row">
                  <span className="my-org-label">{t("organizations.mine.labelName")}</span>
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
                  <span className="my-org-label">{t("organizations.mine.labelWallet")}</span>
                  <code>{org.walletAddress}</code>
                </div>
                {org.contactEmail && (
                  <div className="my-org-row">
                    <span className="my-org-label">{t("organizations.mine.labelEmail")}</span>
                    <span>{org.contactEmail}</span>
                  </div>
                )}
                {org.website && (
                  <div className="my-org-row">
                    <span className="my-org-label">{t("organizations.mine.labelWebsite")}</span>
                    <span>{org.website}</span>
                  </div>
                )}
              </div>

              <div className="my-org-actions">
                <Link to={`/org/${org.slug}`} className="btn-view-public">
                  {t("organizations.mine.viewPublic")}
                </Link>
                {status === "verified" && (
                  <Link
                    to="/charity/create"
                    className="btn-create-campaign"
                  >
                    {t("organizations.mine.createCampaign")}
                  </Link>
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
