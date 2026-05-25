import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

const IMAGE_MAX_SIZE_MB = 10;
const PROOF_MAX_SIZE_MB = 15;
const IMAGE_MAX_SIZE = IMAGE_MAX_SIZE_MB * 1024 * 1024;
const PROOF_MAX_SIZE = PROOF_MAX_SIZE_MB * 1024 * 1024;

function ApplyOrganization() {
  const { t } = useTranslation();
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

  const showFileTooLarge = (file, sizeMb) => {
    showError(
      t("organizations.apply.errors.fileTooLarge", {
        name: file?.name || t("organizations.apply.errors.selectedFile"),
        size: sizeMb,
      })
    );
  };

  const handleImageFileChange = (setter) => (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setter(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      showError(t("organizations.apply.errors.invalidImage"));
      e.target.value = "";
      setter(null);
      return;
    }
    if (file.size > IMAGE_MAX_SIZE) {
      showFileTooLarge(file, IMAGE_MAX_SIZE_MB);
      e.target.value = "";
      setter(null);
      return;
    }
    setter(file);
  };

  const handleProofFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) {
      setProofFiles([]);
      return;
    }

    const invalidFile = files.find(
      (file) => !file.type.startsWith("image/") && file.type !== "application/pdf"
    );
    if (invalidFile) {
      showError(t("organizations.apply.errors.invalidProof"));
      e.target.value = "";
      setProofFiles([]);
      return;
    }

    const oversizedFile = files.find((file) => file.size > PROOF_MAX_SIZE);
    if (oversizedFile) {
      showFileTooLarge(oversizedFile, PROOF_MAX_SIZE_MB);
      e.target.value = "";
      setProofFiles([]);
      return;
    }

    setProofFiles(files);
  };

  async function uploadOne(file) {
    const res = await uploadService.uploadImage(file);
    return res?.url || "";
  }

  async function uploadProof(file) {
    const res = await uploadService.uploadDocument(file);
    return res?.url || "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return showError(t("organizations.apply.errors.nameRequired"));
    if (!form.walletAddress.trim())
      return showError(t("organizations.apply.errors.walletRequired"));
    if (!/^0x[a-fA-F0-9]{40}$/.test(form.walletAddress.trim())) {
      return showError(t("organizations.apply.errors.walletInvalid"));
    }
    if (proofFiles.length === 0) {
      return showError(t("organizations.apply.errors.proofRequired"));
    }
    if (logoFile?.size > IMAGE_MAX_SIZE) {
      return showFileTooLarge(logoFile, IMAGE_MAX_SIZE_MB);
    }
    if (coverFile?.size > IMAGE_MAX_SIZE) {
      return showFileTooLarge(coverFile, IMAGE_MAX_SIZE_MB);
    }
    const oversizedProof = proofFiles.find((file) => file.size > PROOF_MAX_SIZE);
    if (oversizedProof) {
      return showFileTooLarge(oversizedProof, PROOF_MAX_SIZE_MB);
    }

    setSubmitting(true);
    try {
      const [logoUrl, coverUrl, proofUrls] = await Promise.all([
        logoFile ? uploadOne(logoFile) : Promise.resolve(""),
        coverFile ? uploadOne(coverFile) : Promise.resolve(""),
        Promise.all(proofFiles.map((f) => uploadProof(f))),
      ]);

      const res = await organizationService.apply({
        ...form,
        logo: logoUrl,
        coverImage: coverUrl,
        proofDocuments: proofUrls.filter(Boolean),
      });

      if (res?.success) {
        showSuccess(t("organizations.apply.successToast"));
        navigate("/organizations/mine");
      }
    } catch (err) {
      showError(
        err?.response?.data?.message || t("organizations.apply.errors.submitFailed")
      );
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
          <h1>{t("organizations.apply.title")}</h1>
          <p className="apply-org-subtitle">{t("organizations.apply.subtitle")}</p>

          <form onSubmit={handleSubmit} className="apply-org-form">
            <div className="form-group">
              <label>{t("organizations.apply.name")} *</label>
              <input
                type="text"
                value={form.name}
                onChange={handleChange("name")}
                placeholder={t("organizations.apply.namePlaceholder")}
                maxLength={100}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.description")}</label>
              <textarea
                value={form.description}
                onChange={handleChange("description")}
                placeholder={t("organizations.apply.descriptionPlaceholder")}
                rows={4}
                maxLength={500}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.wallet")} *</label>
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
                    {t("organizations.apply.connectMetaMask")}
                  </button>
                )}
              </div>
              <small>{t("organizations.apply.walletHint")}</small>
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.contactEmail")}</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={handleChange("contactEmail")}
                placeholder={t("organizations.apply.contactEmailPlaceholder")}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.website")}</label>
              <input
                type="url"
                value={form.website}
                onChange={handleChange("website")}
                placeholder={t("organizations.apply.websitePlaceholder")}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.categories")}</label>
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
                    {t(`organizations.category.${cat}`, { defaultValue: cat })}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.logo")}</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange(setLogoFile)}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.cover")}</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange(setCoverFile)}
              />
            </div>

            <div className="form-group">
              <label>{t("organizations.apply.proof")} *</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                required
                onChange={handleProofFilesChange}
              />
              <small>{t("organizations.apply.proofHint")}</small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-submit-apply"
                disabled={submitting}
              >
                {submitting
                  ? t("organizations.apply.submitting")
                  : t("organizations.apply.submit")}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ApplyOrganization;
