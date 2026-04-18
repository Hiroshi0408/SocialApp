import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import { organizationService, uploadService } from "../../api";
import { useWeb3 } from "../../contexts/Web3Context";
import { showError, showSuccess } from "../../utils/toast";
import "./ApplyOrganization.css";

const CATEGORY_OPTIONS = [
  "education",
  "disaster-relief",
  "health",
  "environment",
  "animal",
  "poverty",
];

function ApplyOrganization() {
  const navigate = useNavigate();
  const { walletAddress, connectWallet } = useWeb3();
  const [form, setForm] = useState({
    name: "",
    description: "",
    walletAddress: "",
    contactEmail: "",
    website: "",
    categories: [],
  });
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [proofFiles, setProofFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill wallet khi user connect MetaMask
  useEffect(() => {
    if (walletAddress && !form.walletAddress) {
      setForm((prev) => ({ ...prev, walletAddress }));
    }
  }, [walletAddress, form.walletAddress]);

  const handleChange = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const toggleCategory = (cat) => {
    setForm((prev) => {
      const exists = prev.categories.includes(cat);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== cat)
          : [...prev.categories, cat],
      };
    });
  };

  async function uploadOne(file) {
    const res = await uploadService.uploadImage(file);
    return res?.url || "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return showError("Name is required");
    if (!form.walletAddress.trim()) return showError("Wallet address is required");
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.walletAddress.trim())) {
      return showError("Wallet address format is invalid");
    }

    setSubmitting(true);
    try {
      const [logoUrl, coverUrl, proofUrls] = await Promise.all([
        logoFile ? uploadOne(logoFile) : Promise.resolve(""),
        coverFile ? uploadOne(coverFile) : Promise.resolve(""),
        Promise.all(proofFiles.map((f) => uploadOne(f))),
      ]);

      const res = await organizationService.apply({
        ...form,
        logo: logoUrl,
        coverImage: coverUrl,
        proofDocuments: proofUrls.filter(Boolean),
      });

      if (res?.success) {
        showSuccess("Application submitted. Admin will review shortly.");
        navigate("/organizations/mine");
      }
    } catch (err) {
      showError(err?.response?.data?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="apply-org-page">
      <Sidebar />
      <div className="apply-org-wrapper">
        <Header />
        <main className="apply-org-main">
          <h1>Apply as Organization</h1>
          <p className="apply-org-subtitle">
            Submit your organization for admin review. Once verified, your wallet
            will be whitelisted and you can create charity campaigns.
          </p>

          <form onSubmit={handleSubmit} className="apply-org-form">
            <div className="form-group">
              <label>Organization name *</label>
              <input
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                placeholder="e.g. Red Cross Vietnam"
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={handleChange("description")}
                placeholder="What does your organization do?"
                rows={4}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label>Wallet address *</label>
              <div className="apply-wallet-row">
                <input
                  type="text"
                  value={form.walletAddress}
                  onChange={handleChange("walletAddress")}
                  placeholder="0x..."
                  className="wallet-input"
                />
                {!walletAddress && (
                  <button
                    type="button"
                    className="btn-connect-wallet"
                    onClick={connectWallet}
                  >
                    Connect MetaMask
                  </button>
                )}
              </div>
              <small>
                This wallet will be whitelisted on-chain. Donations to your
                campaigns go directly to this address.
              </small>
            </div>

            <div className="form-group">
              <label>Contact email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={handleChange("contactEmail")}
                placeholder="contact@your-org.com"
              />
            </div>

            <div className="form-group">
              <label>Website</label>
              <input
                type="url"
                value={form.website}
                onChange={handleChange("website")}
                placeholder="https://your-org.com"
              />
            </div>

            <div className="form-group">
              <label>Categories</label>
              <div className="apply-cat-chips">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={
                      "cat-chip " +
                      (form.categories.includes(cat) ? "active" : "")
                    }
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="form-group">
              <label>Cover image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="form-group">
              <label>Proof documents (license, certificate...)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setProofFiles(Array.from(e.target.files || []))
                }
              />
              <small>
                Upload scanned images of your legal documents. These are only
                visible to admin reviewers.
              </small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-submit-apply"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ApplyOrganization;
