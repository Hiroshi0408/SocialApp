import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ethers } from "ethers";
import Header from "../../components/Header/Header";
import Sidebar from "../../components/Sidebar/Sidebar";
import TxStatusModal from "../../components/TxStatusModal/TxStatusModal";
import organizationService from "../../api/organizationService";
import charityService from "../../api/charityService";
import uploadService from "../../api/uploadService";
import { useWeb3 } from "../../contexts/Web3Context";
import { parseWeb3Error, assertSepolia } from "../../utils/web3Errors";
import "./CreateCampaign.css";

const CATEGORIES = ["education", "medical", "disaster", "animal", "other"];
const MAX_MILESTONES = 10;

// Human-readable ABI — chỉ cần createCampaign
const CHARITY_ABI = [
  "function createCampaign(uint256 goal, uint256 durationSec, uint256[] milestoneAmounts, bytes32 metadataHash) external returns (uint256)",
];

const CHARITY_ADDRESS = process.env.REACT_APP_CHARITY_ADDRESS || "";

const emptyMilestone = () => ({ title: "", description: "", amountEth: "" });

function CreateCampaign() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signer, walletAddress, connectWallet, isConnecting } = useWeb3();

  const [orgLoading, setOrgLoading] = useState(true);
  const [org, setOrg] = useState(null);
  const [orgError, setOrgError] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    coverImage: "",
    category: "",
    goalEth: "",
    durationDays: "30",
  });
  const [milestones, setMilestones] = useState([emptyMilestone()]);
  const [coverPreview, setCoverPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});

  // Tx state cho on-chain sign/wait flow
  const [txStatus, setTxStatus] = useState("idle"); // idle|signing|pending|success|failed|rejected
  const [txHash, setTxHash] = useState(null);
  const [txError, setTxError] = useState(null);
  const submitting = ["signing", "pending"].includes(txStatus);

  useEffect(() => {
    organizationService
      .getMine()
      .then((data) => setOrg(data.organization || null))
      .catch((e) => {
        if (e?.response?.status === 404) setOrg(null);
        else setOrgError(e?.response?.data?.message || "Failed to load organization");
      })
      .finally(() => setOrgLoading(false));
  }, []);

  const handleCoverChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview immediately
    setCoverPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const res = await uploadService.uploadImage(file);
      if (res.success) {
        setForm((f) => ({ ...f, coverImage: res.url }));
      }
    } catch {
      toast.error(t("imageUpload.uploadFailedError"));
      setCoverPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const setMilestoneField = (idx, key, value) => {
    setMilestones((ms) => ms.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
    setErrors((e) => ({
      ...e,
      [`milestones.${idx}.${key}`]: undefined,
      milestonesSum: undefined,
    }));
  };

  const addMilestone = () => {
    if (milestones.length >= MAX_MILESTONES) return;
    setMilestones((ms) => [...ms, emptyMilestone()]);
  };

  const removeMilestone = (idx) => {
    if (milestones.length <= 1) return;
    setMilestones((ms) => ms.filter((_, i) => i !== idx));
    setErrors((e) => ({ ...e, milestonesSum: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = t("charity.create.errorRequired");

    const goal = parseFloat(form.goalEth);
    if (!form.goalEth || isNaN(goal) || goal <= 0)
      errs.goalEth = t("charity.create.errorGoalInvalid");

    const dur = parseInt(form.durationDays, 10);
    if (!form.durationDays || isNaN(dur) || dur < 1 || dur > 90)
      errs.durationDays = t("charity.create.errorDuration");

    milestones.forEach((m, i) => {
      if (!m.title.trim())
        errs[`milestones.${i}.title`] = t("charity.create.errorRequired");
      const amt = parseFloat(m.amountEth);
      if (!m.amountEth || isNaN(amt) || amt <= 0)
        errs[`milestones.${i}.amountEth`] = t("charity.create.errorAmountInvalid");
    });

    if (!errs.goalEth && milestones.length > 0) {
      const sum = milestones.reduce((acc, m) => acc + (parseFloat(m.amountEth) || 0), 0);
      if (Math.abs(sum - goal) > 0.000001) {
        errs.milestonesSum = t("charity.create.errorSumMismatch", {
          sum: sum.toFixed(6),
          goal: goal.toFixed(6),
        });
      }
    }

    return errs;
  };

  const resetTx = useCallback(() => {
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
  }, []);

  const buildPayload = () => ({
    organizationId: org.id || org._id,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    coverImage: form.coverImage || undefined,
    category: form.category || undefined,
    goalEth: String(parseFloat(form.goalEth)),
    durationDays: parseInt(form.durationDays, 10),
    milestones: milestones.map((m) => ({
      title: m.title.trim(),
      description: m.description.trim() || undefined,
      amountEth: String(parseFloat(m.amountEth)),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Pre-flight: ví đang connect phải khớp ví của org
    const orgWallet = (org.walletAddress || "").toLowerCase();
    if (!walletAddress || walletAddress.toLowerCase() !== orgWallet) {
      toast.error(t("charity.create.wrongWallet"));
      return;
    }
    if (!CHARITY_ADDRESS) {
      toast.error("Charity contract address not configured");
      return;
    }

    const payload = buildPayload();
    resetTx();

    try {
      // Step 1: BE validate + return params
      setTxStatus("signing");
      const prep = await charityService.prepareCampaign(payload);

      // Pre-flight network
      await assertSepolia();

      // Step 2: ký tx với ví org
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = signer || (await provider.getSigner());
      const contract = new ethers.Contract(CHARITY_ADDRESS, CHARITY_ABI, signerInstance);

      const tx = await contract.createCampaign(
        prep.goalWei,
        prep.durationSec,
        prep.milestoneAmountsWei,
        prep.metadataHash
      );
      setTxHash(tx.hash);
      setTxStatus("pending");

      await tx.wait(1);

      // Step 3: BE verify receipt + lưu Mongo
      const res = await charityService.recordCampaign({ ...payload, txHash: tx.hash });

      setTxStatus("success");
      toast.success(t("charity.create.successToast"));
      // Delay nhẹ để user thấy success state trong modal trước khi điều hướng
      setTimeout(() => {
        navigate(`/charity/${res.campaign.id || res.campaign._id}`);
      }, 800);
    } catch (err) {
      // BE-side error (prepare/record) → response.data.message
      if (err?.response?.data?.message) {
        setTxStatus("failed");
        setTxError(err.response.data.message);
        return;
      }
      // Web3 errors (sign / network)
      if (err.code === "WRONG_NETWORK") {
        setTxStatus("failed");
        setTxError(t("web3.wrongNetwork"));
        return;
      }
      const { type, rawMessage } = parseWeb3Error(err);
      if (type === "rejected") {
        setTxStatus("rejected");
      } else if (type === "insufficient") {
        setTxStatus("failed");
        setTxError(t("web3.error.insufficient"));
      } else {
        setTxStatus("failed");
        setTxError(rawMessage || t("charity.create.errorFailed"));
      }
    }
  };

  // ── Guard states ──
  if (orgLoading) {
    return (
      <div className="create-campaign-page">
        <Sidebar />
        <div className="create-campaign-wrapper">
          <Header />
          <main className="create-campaign-main">
            <div className="cc-loading">{t("charity.detail.loading")}</div>
          </main>
        </div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="create-campaign-page">
        <Sidebar />
        <div className="create-campaign-wrapper">
          <Header />
          <main className="create-campaign-main">
            <div className="cc-guard">
              <p className="cc-guard-desc">{orgError}</p>
              <Link to="/charity" className="cc-guard-cta">{t("charity.detail.backToList")}</Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isVerified = org?.status === "verified";
  const isPending = org?.status === "pending";

  if (!org || !isVerified) {
    return (
      <div className="create-campaign-page">
        <Sidebar />
        <div className="create-campaign-wrapper">
          <Header />
          <main className="create-campaign-main">
            <div className="cc-guard">
              <div className="cc-guard-icon">🏢</div>
              <h2 className="cc-guard-title">{t("charity.create.noOrgTitle")}</h2>
              <p className="cc-guard-desc">
                {isPending
                  ? t("charity.create.pendingOrgDesc")
                  : t("charity.create.noOrgDesc")}
              </p>
              <Link
                to={isPending ? "/organizations/mine" : "/organizations/apply"}
                className="cc-guard-cta"
              >
                {isPending
                  ? t("charity.create.pendingOrgCta")
                  : t("charity.create.noOrgCta")}
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ── Live sum for milestone hint ──
  const goal = parseFloat(form.goalEth) || 0;
  const sum = milestones.reduce((acc, m) => acc + (parseFloat(m.amountEth) || 0), 0);
  const sumOk = goal > 0 && Math.abs(sum - goal) < 0.000001;

  // Wallet pre-check — chỉ ví ORG mới có quyền tạo (contract enforce)
  const orgWallet = (org.walletAddress || "").toLowerCase();
  const connectedWallet = (walletAddress || "").toLowerCase();
  const walletMatches = !!walletAddress && connectedWallet === orgWallet;
  const walletConnected = !!walletAddress;

  return (
    <div className="create-campaign-page">
      <Sidebar />
      <div className="create-campaign-wrapper">
        <Header />
        <main className="create-campaign-main">
          <div className="cc-header">
            <h1>{t("charity.create.title")}</h1>
            <p className="cc-subtitle">{t("charity.create.subtitle")}</p>
            <div className="cc-org-badge">
              {t("charity.create.orgLabel")}: <strong>{org.name}</strong>
            </div>
          </div>

          <form className="cc-form" onSubmit={handleSubmit} noValidate>
            {/* Cover image */}
            <div className="cc-section">
              <label className="cc-label">{t("charity.create.labelCoverImage")}</label>
              <div className="cc-cover-wrap">
                {coverPreview ? (
                  <img src={coverPreview} alt="cover" className="cc-cover-preview" />
                ) : (
                  <div className="cc-cover-placeholder">
                    <span>📷</span>
                    <span>{t("charity.create.uploadCover")}</span>
                  </div>
                )}
                <label className="cc-upload-btn">
                  {uploading
                    ? t("charity.create.uploading")
                    : coverPreview
                    ? t("charity.create.changeCover")
                    : t("charity.create.uploadCover")}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleCoverChange}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Title */}
            <div className="cc-field">
              <label className="cc-label">
                {t("charity.create.labelTitle")} <span className="cc-required">*</span>
              </label>
              <input
                className={`cc-input ${errors.title ? "cc-input--error" : ""}`}
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={200}
                placeholder={t("charity.create.placeholderTitle")}
              />
              {errors.title && <div className="cc-error">{errors.title}</div>}
            </div>

            {/* Description */}
            <div className="cc-field">
              <label className="cc-label">{t("charity.create.labelDescription")}</label>
              <textarea
                className="cc-textarea"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                maxLength={5000}
                rows={5}
                placeholder={t("charity.create.placeholderDescription")}
              />
            </div>

            {/* Category */}
            <div className="cc-field">
              <label className="cc-label">{t("charity.create.labelCategory")}</label>
              <select
                className="cc-select"
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                <option value="">{t("charity.filters.allCategories")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`charity.category.${c}`)}
                  </option>
                ))}
              </select>
            </div>

            {/* Goal + Duration */}
            <div className="cc-row">
              <div className="cc-field">
                <label className="cc-label">
                  {t("charity.create.labelGoal")} <span className="cc-required">*</span>
                </label>
                <div className="cc-input-wrap">
                  <input
                    className={`cc-input ${errors.goalEth ? "cc-input--error" : ""}`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={form.goalEth}
                    onChange={(e) => setField("goalEth", e.target.value)}
                    placeholder="0.5"
                  />
                  <span className="cc-input-unit">ETH</span>
                </div>
                <div className="cc-hint">{t("charity.create.goalHint")}</div>
                {errors.goalEth && <div className="cc-error">{errors.goalEth}</div>}
              </div>

              <div className="cc-field">
                <label className="cc-label">
                  {t("charity.create.labelDuration")} <span className="cc-required">*</span>
                </label>
                <div className="cc-input-wrap">
                  <input
                    className={`cc-input ${errors.durationDays ? "cc-input--error" : ""}`}
                    type="number"
                    min="1"
                    max="90"
                    step="1"
                    value={form.durationDays}
                    onChange={(e) => setField("durationDays", e.target.value)}
                    placeholder="30"
                  />
                  <span className="cc-input-unit">{t("charity.create.days")}</span>
                </div>
                <div className="cc-hint">{t("charity.create.durationHint")}</div>
                {errors.durationDays && <div className="cc-error">{errors.durationDays}</div>}
              </div>
            </div>

            {/* Milestones */}
            <div className="cc-section">
              <div className="cc-milestones-header">
                <label className="cc-label">
                  {t("charity.create.labelMilestones")} <span className="cc-required">*</span>
                </label>
                {goal > 0 && (
                  <span className={`cc-sum-badge ${sumOk ? "cc-sum-badge--ok" : "cc-sum-badge--mismatch"}`}>
                    {t("charity.create.sumLabel", {
                      sum: sum.toFixed(4),
                      goal: goal.toFixed(4),
                    })}
                    {sumOk ? " ✓" : ""}
                  </span>
                )}
              </div>

              <p className="cc-milestones-hint">{t("charity.create.milestonesHint")}</p>

              {milestones.map((m, idx) => (
                <div key={idx} className="cc-milestone">
                  <div className="cc-milestone-toprow">
                    <span className="cc-milestone-num">#{idx + 1}</span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        className="cc-remove-btn"
                        onClick={() => removeMilestone(idx)}
                      >
                        {t("charity.create.removeMilestone")}
                      </button>
                    )}
                  </div>
                  <div className="cc-milestone-row">
                    <div className="cc-field cc-field--grow">
                      <input
                        className={`cc-input ${
                          errors[`milestones.${idx}.title`] ? "cc-input--error" : ""
                        }`}
                        value={m.title}
                        onChange={(e) => setMilestoneField(idx, "title", e.target.value)}
                        placeholder={t("charity.create.milestoneTitle")}
                        maxLength={200}
                      />
                      {errors[`milestones.${idx}.title`] && (
                        <div className="cc-error">{errors[`milestones.${idx}.title`]}</div>
                      )}
                    </div>
                    <div className="cc-field cc-field--amount">
                      <div className="cc-input-wrap">
                        <input
                          className={`cc-input ${
                            errors[`milestones.${idx}.amountEth`] ? "cc-input--error" : ""
                          }`}
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={m.amountEth}
                          onChange={(e) => setMilestoneField(idx, "amountEth", e.target.value)}
                          placeholder="ETH"
                        />
                        <span className="cc-input-unit">ETH</span>
                      </div>
                      {errors[`milestones.${idx}.amountEth`] && (
                        <div className="cc-error">{errors[`milestones.${idx}.amountEth`]}</div>
                      )}
                    </div>
                  </div>
                  <input
                    className="cc-input cc-input--desc"
                    value={m.description}
                    onChange={(e) => setMilestoneField(idx, "description", e.target.value)}
                    placeholder={t("charity.create.milestoneDescription")}
                    maxLength={1000}
                  />
                </div>
              ))}

              {errors.milestonesSum && (
                <div className="cc-error cc-error--sum">{errors.milestonesSum}</div>
              )}

              {milestones.length < MAX_MILESTONES && (
                <button type="button" className="cc-add-btn" onClick={addMilestone}>
                  + {t("charity.create.addMilestone")}
                </button>
              )}
            </div>

            {/* Wallet status — org phải tự ký tx tạo campaign */}
            <div className="cc-section">
              {!walletConnected && (
                <div className="cc-wallet-banner cc-wallet-banner--warn">
                  <p className="cc-wallet-banner-text">
                    {t("charity.create.connectWalletHint")}
                  </p>
                  <button
                    type="button"
                    className="cc-wallet-banner-btn"
                    onClick={connectWallet}
                    disabled={isConnecting}
                  >
                    {isConnecting
                      ? t("charity.donate.connecting")
                      : t("charity.donate.connectWallet")}
                  </button>
                </div>
              )}
              {walletConnected && !walletMatches && (
                <div className="cc-wallet-banner cc-wallet-banner--error">
                  <p className="cc-wallet-banner-text">
                    {t("charity.create.wrongWalletHint", {
                      expected: orgWallet.slice(0, 6) + "..." + orgWallet.slice(-4),
                      got: connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4),
                    })}
                  </p>
                </div>
              )}
              {walletMatches && (
                <div className="cc-wallet-banner cc-wallet-banner--ok">
                  <p className="cc-wallet-banner-text">
                    {t("charity.create.walletReady", {
                      address:
                        connectedWallet.slice(0, 6) + "..." + connectedWallet.slice(-4),
                    })}
                  </p>
                </div>
              )}
            </div>

            <div className="cc-form-footer">
              <Link to="/charity" className="cc-cancel-btn">
                {t("charity.create.cancel")}
              </Link>
              <button
                type="submit"
                className="cc-submit-btn"
                disabled={submitting || uploading || !walletMatches}
              >
                {submitting ? t("charity.create.submitting") : t("charity.create.submit")}
              </button>
            </div>
          </form>
        </main>
      </div>

      <TxStatusModal
        isOpen={txStatus !== "idle"}
        onClose={resetTx}
        status={txStatus}
        txHash={txHash}
        errorMsg={txError}
        title={t("charity.create.txTitle")}
        onRetry={resetTx}
      />
    </div>
  );
}

export default CreateCampaign;
