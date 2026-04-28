import React, { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import GroupsTab from "./GroupsTab";
import OrganizationsTab from "./OrganizationsTab";
import "./Communities.css";

// 2 entity (Group + Organization) gom chung 1 page vì cả 2 đều là "community"
// user có thể browse / join. Sidebar chỉ còn 1 entry "Cộng đồng" để giảm rối,
// Organization profile vẫn truy cập qua link từ campaign card / verified badge.
const VALID_TABS = ["groups", "orgs"];

function Communities() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab = VALID_TABS.includes(rawTab) ? rawTab : "groups";

  const handleTabChange = (next) => {
    if (next === tab) return;
    // replace để không spam history khi user đổi tab qua lại
    setSearchParams({ tab: next }, { replace: true });
  };

  const tabs = useMemo(
    () => [
      { key: "groups", label: t("communities.tabs.groups") },
      { key: "orgs", label: t("communities.tabs.orgs") },
    ],
    [t]
  );

  return (
    <div className="communities-page">
      <Sidebar />
      <div className="communities-wrapper">
        <Header />
        <main className="communities-main">
          <header className="communities-header">
            <div>
              <h1 className="communities-title">{t("communities.title")}</h1>
              <p className="communities-subtitle">
                {t(`communities.subtitle.${tab}`)}
              </p>
            </div>
          </header>

          <nav className="communities-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={`communities-tab ${tab === item.key ? "active" : ""}`}
                onClick={() => handleTabChange(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="communities-body">
            {tab === "groups" ? <GroupsTab /> : <OrganizationsTab />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Communities;
