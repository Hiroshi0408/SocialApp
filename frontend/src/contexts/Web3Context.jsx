import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import ConfirmDialog from "../components/ConfirmDialog/ConfirmDialog";
import web3Service from "../api/web3Service";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const { t } = useTranslation();
  const { user: currentUser, logout, updateUser } = useAuth();
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState(null);
  // Modal hỏi user khi MetaMask đổi sang ví KHÁC ví đang link.
  // Tách state để handler accountsChanged không gọi async dialog inline (closure stale).
  const [switchModal, setSwitchModal] = useState({ open: false, address: null });

  // Dùng BrowserProvider trực tiếp — eth_getBalance không cần authorization
  const fetchBalance = useCallback(async (address) => {
    if (!address || !window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const raw = await provider.getBalance(address);
      const formatted = parseFloat(ethers.formatEther(raw)).toFixed(4);
      setBalance(formatted);
    } catch {
      setBalance(null);
    }
  }, []);

  // Switch sang Sepolia — nếu chưa có thì thêm mới vào MetaMask
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
    } catch (err) {
      // 4902: chain chưa có trong MetaMask → thêm mới
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia Testnet",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
      } else {
        throw err;
      }
    }
  };

  const disconnectWallet = useCallback(() => {
    setWalletAddress(null);
    setSigner(null);
    setBalance(null);
  }, []);

  // Auto-reconnect khi page load — dùng eth_accounts (không popup)
  // Chỉ restore nếu đã authorize VÀ đang đúng mạng Sepolia
  useEffect(() => {
    const tryAutoConnect = async () => {
      if (!window.ethereum) return;
      try {
        const [accounts, chainId] = await Promise.all([
          window.ethereum.request({ method: "eth_accounts" }),
          window.ethereum.request({ method: "eth_chainId" }),
        ]);
        if (accounts.length === 0) return;
        // Không switch network tự động khi auto-connect (sẽ hiện MetaMask popup)
        // Chỉ restore state + fetch balance nếu đang đúng mạng
        if (chainId !== SEPOLIA_CHAIN_ID) return;

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();

        setSigner(signerInstance);
        setWalletAddress(address);
        await fetchBalance(address);
      } catch {
        // MetaMask locked hoặc lỗi nội bộ — bỏ qua
      }
    };
    tryAutoConnect();
  }, [fetchBalance]);

  // accountsChanged: user đổi account hoặc disconnect ví trong MetaMask.
  // Logic chia theo loại user:
  //   - Wallet-only user (identity = ví) → buộc logout, redirect login.
  //   - Email/Google user (ví là phụ trợ) → chỉ disconnect UI, giữ session.
  // Tránh trường hợp UI hiện ví B nhưng JWT vẫn của user A → ký giao dịch
  // bằng ví không khớp record BE.
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        toast(t("web3.disconnected"), { icon: "👛" });
        return;
      }
      const newAddress = accounts[0].toLowerCase();
      if (newAddress === walletAddress?.toLowerCase()) return;

      const linkedWallet = currentUser?.walletAddress?.toLowerCase();

      if (linkedWallet && newAddress === linkedWallet) {
        try {
          const chainId = await window.ethereum.request({ method: "eth_chainId" });
          if (chainId !== SEPOLIA_CHAIN_ID) {
            setWalletAddress(newAddress);
            setSigner(null);
            setBalance(null);
            toast.error(t("web3.wrongNetwork"));
            return;
          }
          const provider = new ethers.BrowserProvider(window.ethereum);
          const signerInstance = await provider.getSigner();
          setSigner(signerInstance);
          setWalletAddress(newAddress);
          await fetchBalance(newAddress);
          toast.success(t("web3.accountSwitched"));
        } catch {
          disconnectWallet();
        }
        return;
      }

      // Ví mới ≠ ví đang link → mở modal hỏi user có muốn switch user app không.
      // Modal handler tự xử lý case wallet-only / email khi confirm/cancel.
      setSwitchModal({ open: true, address: newAddress });
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [walletAddress, fetchBalance, disconnectWallet, t, currentUser, logout]);

  // Modal confirm: ký nonce + walletLogin → swap session sang user link với ví mới
  // (BE auto-create user_xxx nếu ví chưa link với ai).
  const handleSwitchConfirm = async () => {
    const targetAddress = switchModal.address;
    setSwitchModal({ open: false, address: null });
    if (!targetAddress) return;
    try {
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        toast.error(t("web3.wrongNetwork"));
        return;
      }
      const nonceData = await web3Service.getNonce(targetAddress);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await provider.getSigner();
      const signature = await signerInstance.signMessage(nonceData.message);
      const response = await web3Service.walletLogin(
        targetAddress,
        signature,
        nonceData.message
      );
      if (response.success && response.user) {
        updateUser(response.user);
        setSigner(signerInstance);
        setWalletAddress(targetAddress);
        await fetchBalance(targetAddress);
        toast.success(
          t("web3.switchUser.success", { username: response.user.username })
        );
      } else {
        throw new Error("walletLogin failed");
      }
    } catch (err) {
      toast.error(t("web3.switchUser.failed"));
      const isWalletOnlyUser = currentUser && !currentUser.email;
      disconnectWallet();
      if (isWalletOnlyUser) setTimeout(() => logout(), 1500);
    }
  };

  // Modal cancel: giữ user hiện tại.
  // Wallet-only → vẫn phải logout (mismatch nguy hiểm). Email → chỉ disconnect ví UI.
  const handleSwitchCancel = () => {
    setSwitchModal({ open: false, address: null });
    const isWalletOnlyUser = currentUser && !currentUser.email;
    if (isWalletOnlyUser) {
      disconnectWallet();
      toast.error(t("web3.walletChangedMustRelogin"));
      setTimeout(() => logout(), 1500);
    } else {
      disconnectWallet();
      toast(t("web3.walletDisconnectedNotLinked"), { icon: "🔌" });
    }
  };

  // chainChanged: user đổi network trong MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handleChainChanged = async (chainId) => {
      if (chainId !== SEPOLIA_CHAIN_ID) {
        // Sai mạng — clear signer + balance, giữ address để UX đỡ giật
        setSigner(null);
        setBalance(null);
        toast.error(t("web3.wrongNetwork"));
        return;
      }
      // Quay về Sepolia — restore signer nếu đang có ví
      if (!walletAddress) return;
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        setSigner(signerInstance);
        await fetchBalance(walletAddress);
        toast.success(t("web3.backToSepolia"));
      } catch {
        // MetaMask có thể cần unlock — bỏ qua
      }
    };
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => window.ethereum.removeListener("chainChanged", handleChainChanged);
  }, [walletAddress, fetchBalance, t]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast.error(t("web3.noProvider"));
      return;
    }
    try {
      setIsConnecting(true);

      // Đảm bảo đang ở Sepolia trước khi lấy signer
      await switchToSepolia();

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await provider.getSigner();
      const address = await signerInstance.getAddress();

      setSigner(signerInstance);
      setWalletAddress(address);
      await fetchBalance(address);

      return { address, signer: signerInstance };
    } catch (error) {
      if (
        error.code === "ACTION_REJECTED" ||
        error.code === 4001 ||
        error?.info?.error?.code === 4001
      ) {
        toast(t("web3.connectRejected"), { icon: "🚫" });
      } else {
        toast.error(t("web3.connectFailed"));
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const isWalletOnlyUser = currentUser && !currentUser.email;

  return (
    <Web3Context.Provider
      value={{
        walletAddress,
        isConnecting,
        connectWallet,
        disconnectWallet,
        signer,
        balance,
        fetchBalance,
      }}
    >
      {children}
      <ConfirmDialog
        isOpen={switchModal.open}
        onClose={handleSwitchCancel}
        onConfirm={handleSwitchConfirm}
        title={t("web3.switchUser.title")}
        message={
          isWalletOnlyUser
            ? t("web3.switchUser.messageWalletOnly")
            : t("web3.switchUser.messageEmail")
        }
        confirmText={t("web3.switchUser.confirm")}
        cancelText={
          isWalletOnlyUser
            ? t("web3.switchUser.cancelWalletOnly")
            : t("web3.switchUser.cancelEmail")
        }
      />
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error("useWeb3 must be used within Web3Provider");
  }
  return context;
};
