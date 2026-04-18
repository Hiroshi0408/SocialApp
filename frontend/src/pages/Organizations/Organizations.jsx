import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import OrganizationCard from "../../components/OrganizationCard/OrganizationCard";
import { organizationService } from "../../api";
import { showError } from "../../utils/toast";
import "./Organizations.css";

function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      const res = await organizationService.list(params);
      if (res?.success) setOrganizations(res.organizations || []);
    } catch (err) {
      showError("Failed to load organizations");
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  return (
    <div className="organizations-page">
      <Sidebar />
      <div className="organizations-wrapper">
        <Header />
        <main className="organizations-main">
          <header className="organizations-header">
            <div>
              <h1>Verified Organizations</h1>
              <p className="organizations-subtitle">
                Browse charity organizations verified by our admin team
              </p>
            </div>
            <Link to="/organizations/apply" className="btn-apply-org">
              Apply as organization
            </Link>
          </header>

          <div className="organizations-filters">
            <input
              type="text"
              className="org-search-input"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="org-filter-select"
            >
              <option value="">All categories</option>
              <option value="education">Education</option>
              <option value="disaster-relief">Disaster relief</option>
              <option value="health">Health</option>
              <option value="environment">Environment</option>
              <option value="animal">Animal welfare</option>
            </select>
          </div>

          {loading && (
            <p className="organizations-empty">Loading organizations...</p>
          )}

          {!loading && organizations.length === 0 && (
            <p className="organizations-empty">
              No verified organizations yet.
            </p>
          )}

          <div className="organizations-grid">
            {organizations.map((org) => (
              <OrganizationCard key={org.id} org={org} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Organizations;
