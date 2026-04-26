import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const { t } = useTranslation();
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState(null);

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

  // accountsChanged: user đổi account hoặc disconnect ví trong MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        toast(t("web3.disconnected"), { icon: "👛" });
        return;
      }
      // Không làm gì nếu vẫn là account cũ
      if (accounts[0].toLowerCase() === walletAddress?.toLowerCase()) return;
      try {
        const chainId = await window.ethereum.request({ method: "eth_chainId" });
        if (chainId !== SEPOLIA_CHAIN_ID) {
          // Đổi account trên sai mạng — cập nhật address nhưng clear signer
          setWalletAddress(accounts[0]);
          setSigner(null);
          setBalance(null);
          toast.error(t("web3.wrongNetwork"));
          return;
        }
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signerInstance = await provider.getSigner();
        const address = await signerInstance.getAddress();
        setSigner(signerInstance);
        setWalletAddress(address);
        await fetchBalance(address);
        toast.success(t("web3.accountSwitched"));
      } catch {
        disconnectWallet();
      }
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, [walletAddress, fetchBalance, disconnectWallet, t]);

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
