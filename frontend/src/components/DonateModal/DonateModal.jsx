/* global BigInt */
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";
import { useWeb3 } from "../../contexts/Web3Context";
import { charityService } from "../../api";
import TxStatusModal from "../TxStatusModal/TxStatusModal";
import "./DonateModal.css";

// Human-readable ABI — chỉ cần hàm donate
const CHARITY_ABI = ["function donate(uint256 id) external payable"];

const CHARITY_ADDRESS = process.env.REACT_APP_CHARITY_ADDRESS || "";

// Giữ lại ít nhất 0.002 ETH để trả gas
const GAS_RESERVE = 0.002;
const MIN_DONATE = 0.001;

function DonateModal({ isOpen, onClose, campaign, onSuccess }) {
  const { t } = useTranslation();
  const { signer, walletAddress, connectWallet, isConnecting, balance, fetchBalance } =
    useWeb3();

  const [amount, setAmount] = useState("");
  const [txStatus, setTxStatus] = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const resetTx = useCallback(() => {
    setTxStatus("idle");
    setTxHash(null);
    setErrorMsg(null);
  }, []);

  const handleClose = useCallback(() => {
    if (["signing", "pending"].includes(txStatus)) return;
    resetTx();
    setAmount("");
    onClose();
  }, [txStatus, resetTx, onClose]);

  // Pre-flight: validate amount + balance trước khi bắt đầu tx
  const validate = () => {
    const num = parseFloat(amount);
    if (!amount || isNaN(num) || num < MIN_DONATE) {
      return t("charity.donate.minError", { min: MIN_DONATE });
    }
    if (balance !== null && num > parseFloat(balance) - GAS_RESERVE) {
      return t("charity.donate.insufficientBalance");
    }
    return null;
  };

  const handleDonate = useCallback(async () => {
    if (!campaign || campaign.onChainId === null || campaign.onChainId === undefined) return;

    const validationErr = validate();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }
    setErrorMsg(null);

    try {
      setTxStatus("signing");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = signer || (await provider.getSigner());
      const contract = new ethers.Contract(CHARITY_ADDRESS, CHARITY_ABI, signerInstance);
      const valueWei = ethers.parseEther(amount);

      const tx = await contract.donate(campaign.onChainId, { value: valueWei });
      setTxHash(tx.hash);
      setTxStatus("pending");

      // Đợi 1 block confirm
      await tx.wait(1);

      // BE tự verify receipt — FE chỉ gửi txHash
      await charityService.recordDonation(campaign._id || campaign.id, {
        txHash: tx.hash,
        onChainCampaignId: campaign.onChainId,
      });

      setTxStatus("success");
      // Refresh balance + campaign detail
      if (walletAddress) fetchBalance(walletAddress);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (
        err.code === "ACTION_REJECTED" ||
        err.code === 4001 ||
        err?.info?.error?.code === 4001
      ) {
        setTxStatus("rejected");
      } else if (
        err.code === "INSUFFICIENT_FUNDS" ||
        err?.info?.error?.code === -32000
      ) {
        setTxStatus("failed");
        setErrorMsg(t("charity.donate.insufficientBalance"));
      } else {
        setTxStatus("failed");
        // ethers v6: err.reason hoặc err.shortMessage
        setErrorMsg(err.reason || err.shortMessage || err.message || t("charity.tx.unknownError"));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, amount, signer, walletAddress, fetchBalance, onSuccess, t]);

  // Tính remaining ETH có thể donate (goal - raised)
  const remainingEth = (() => {
    try {
      if (!campaign?.goalWei || !campaign?.raisedWei) return null;
      const remaining = BigInt(campaign.goalWei) - BigInt(campaign.raisedWei);
      if (remaining <= 0n) return "0";
      return parseFloat(ethers.formatEther(remaining)).toFixed(4);
    } catch {
      return null;
    }
  })();

  // Nếu user chưa connect ví — chỉ hiện nút connect
  if (!walletAddress) {
    return (
      <TxStatusModal
        isOpen={isOpen}
        onClose={onClose}
        status="idle"
        title={t("charity.donate.title")}
      >
        <div className="donate-modal-connect">
          <p className="donate-modal-connect-hint">{t("charity.donate.connectHint")}</p>
          <button
            type="button"
            className="donate-modal-connect-btn"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? t("charity.donate.connecting") : t("charity.donate.connectWallet")}
          </button>
        </div>
      </TxStatusModal>
    );
  }

  return (
    <TxStatusModal
      isOpen={isOpen}
      onClose={handleClose}
      status={txStatus}
      txHash={txHash}
      errorMsg={errorMsg}
      title={t("charity.donate.title")}
      onRetry={resetTx}
    >
      {/* Form donate — chỉ hiển thị khi status === "idle" */}
      <form
        className="donate-modal-form"
        onSubmit={(e) => { e.preventDefault(); handleDonate(); }}
        noValidate
      >
        <div className="donate-modal-campaign-name">
          {campaign?.title}
        </div>

        <div className="donate-modal-balance-row">
          <span className="donate-modal-balance-label">
            {t("charity.donate.yourBalance")}
          </span>
          <span className="donate-modal-balance-value">
            {balance !== null ? `${balance} ETH` : "—"}
          </span>
        </div>

        {remainingEth !== null && (
          <div className="donate-modal-remaining-row">
            <span className="donate-modal-remaining-label">
              {t("charity.donate.remainingToGoal")}
            </span>
            <span className="donate-modal-remaining-value">
              {remainingEth} ETH
            </span>
          </div>
        )}

        <div className="donate-modal-field">
          <label className="donate-modal-label" htmlFor="donate-amount">
            {t("charity.donate.amountLabel")}
          </label>
          <div className="donate-modal-input-wrap">
            <input
              id="donate-amount"
              type="number"
              step="0.001"
              min={MIN_DONATE}
              className="donate-modal-input"
              placeholder={`min ${MIN_DONATE} ETH`}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setErrorMsg(null);
              }}
              autoFocus
            />
            <span className="donate-modal-input-unit">ETH</span>
          </div>
          {errorMsg && (
            <p className="donate-modal-field-error">{errorMsg}</p>
          )}
        </div>

        <button
          type="submit"
          className="donate-modal-submit"
          disabled={!amount}
        >
          {t("charity.donate.confirm")}
        </button>

        <p className="donate-modal-disclaimer">
          {t("charity.donate.disclaimer")}
        </p>
      </form>
    </TxStatusModal>
  );
}

export default DonateModal;
