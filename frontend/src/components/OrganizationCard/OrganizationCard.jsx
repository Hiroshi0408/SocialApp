import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import VerifiedBadge from "../VerifiedBadge/VerifiedBadge";
import "./OrganizationCard.css";

function OrganizationCard({ org }) {
  const { t } = useTranslation();
  if (!org) return null;

  return (
    <Link to={`/org/${org.slug}`} className="org-card">
      <div className="org-card-cover">
        {org.coverImage ? (
          <img src={org.coverImage} alt={org.name} />
        ) : (
          <div className="org-card-cover-placeholder" />
        )}
      </div>
      <div className="org-card-body">
        <div className="org-card-logo">
          {org.logo ? (
            <img src={org.logo} alt="" />
          ) : (
            <div className="org-card-logo-fallback">
              {org.name?.[0]?.toUpperCase() || "O"}
            </div>
          )}
        </div>
        <div className="org-card-info">
          <div className="org-card-name">
            <span>{org.name}</span>
            {org.status === "verified" && (
              <VerifiedBadge verifiedAt={org.verifiedAt} size="sm" />
            )}
          </div>
          {org.categories?.length > 0 && (
            <div className="org-card-categories">
              {org.categories.slice(0, 2).map((c) => (
                <span key={c} className="org-card-tag">
                  {t(`organizations.category.${c}`, { defaultValue: c })}
                </span>
              ))}
            </div>
          )}
          <div className="org-card-stats">
            <span>
              {t("organizations.card.campaigns", {
                count: org.campaignsCount || 0,
              })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default OrganizationCard;
