import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ethers } from "ethers";
import { useWeb3 } from "../../contexts/Web3Context";
import charityService from "../../api/charityService";
import TxStatusModal from "../TxStatusModal/TxStatusModal";
import "./ClaimRefundModal.css";

// Chỉ cần claimRefund + contributions getter (public mapping)
const CHARITY_ABI = [
  "function claimRefund(uint256 id) external",
  "function contributions(uint256, address) external view returns (uint256)",
];

const CHARITY_ADDRESS = process.env.REACT_APP_CHARITY_ADDRESS || "";

function ClaimRefundModal({ isOpen, onClose, campaign, onSuccess }) {
  const { t } = useTranslation();
  const { signer, walletAddress, connectWallet, isConnecting, fetchBalance } = useWeb3();

  const [contributionWei, setContributionWei] = useState(null);
  const [txStatus, setTxStatus] = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Đọc số ETH user đã donate (contributions mapping on-chain)
  useEffect(() => {
    if (!isOpen || !walletAddress || campaign?.onChainId === null || campaign?.onChainId === undefined) {
      setContributionWei(null);
      return;
    }
    const load = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CHARITY_ADDRESS, CHARITY_ABI, provider);
        const amount = await contract.contributions(campaign.onChainId, walletAddress);
        setContributionWei(amount.toString());
      } catch {
        setContributionWei(null);
      }
    };
    load();
  }, [isOpen, walletAddress, campaign?.onChainId]);

  const resetTx = useCallback(() => {
    setTxStatus("idle");
    setTxHash(null);
    setErrorMsg(null);
  }, []);

  const handleClose = useCallback(() => {
    if (["signing", "pending"].includes(txStatus)) return;
    resetTx();
    onClose();
  }, [txStatus, resetTx, onClose]);

  const handleClaim = useCallback(async () => {
    if (!campaign || campaign.onChainId === null || campaign.onChainId === undefined) return;
    if (contributionWei === "0" || contributionWei === null) return;

    try {
      setTxStatus("signing");
      setErrorMsg(null);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = signer || (await provider.getSigner());
      const contract = new ethers.Contract(CHARITY_ADDRESS, CHARITY_ABI, signerInstance);

      const tx = await contract.claimRefund(campaign.onChainId);
      setTxHash(tx.hash);
      setTxStatus("pending");

      await tx.wait(1);

      await charityService.recordRefund(campaign._id || campaign.id, {
        txHash: tx.hash,
        onChainCampaignId: campaign.onChainId,
      });

      setTxStatus("success");
      if (walletAddress) fetchBalance(walletAddress);
      if (onSuccess) onSuccess();
    } catch (err) {
      if (
        err.code === "ACTION_REJECTED" ||
        err.code === 4001 ||
        err?.info?.error?.code === 4001
      ) {
        setTxStatus("rejected");
      } else {
        setTxStatus("failed");
        setErrorMsg(err.reason || err.shortMessage || err.message || t("charity.tx.unknownError"));
      }
    }
  }, [campaign, contributionWei, signer, walletAddress, fetchBalance, onSuccess, t]);

  const refundEth = (() => {
    try {
      if (!contributionWei || contributionWei === "0") return null;
      return parseFloat(ethers.formatEther(contributionWei)).toFixed(6);
    } catch {
      return null;
    }
  })();

  if (!walletAddress) {
    return (
      <TxStatusModal
        isOpen={isOpen}
        onClose={onClose}
        status="idle"
        title={t("charity.claimRefund.title")}
      >
        <div className="claim-refund-connect">
          <p className="claim-refund-connect-hint">{t("charity.donate.connectHint")}</p>
          <button
            type="button"
            className="claim-refund-connect-btn"
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
      title={t("charity.claimRefund.title")}
      onRetry={resetTx}
    >
      <div className="claim-refund-body">
        <p className="claim-refund-desc">{t("charity.claimRefund.desc")}</p>

        <div className="claim-refund-amount-row">
          <span className="claim-refund-amount-label">
            {t("charity.claimRefund.amountLabel")}
          </span>
          <span className="claim-refund-amount-value">
            {refundEth !== null ? `${refundEth} ETH` : "—"}
          </span>
        </div>

        {(contributionWei === "0" || refundEth === null) && (
          <p className="claim-refund-no-contribution">
            {t("charity.claimRefund.noContribution")}
          </p>
        )}

        <button
          type="button"
          className="claim-refund-submit"
          onClick={handleClaim}
          disabled={!refundEth}
        >
          {t("charity.claimRefund.confirm")}
        </button>
      </div>
    </TxStatusModal>
  );
}

export default ClaimRefundModal;
