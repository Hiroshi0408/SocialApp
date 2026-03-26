import React, { createContext, useContext, useState } from "react";
import { ethers } from "ethers";
const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [signer, setSigner] = useState(null);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Vui lòng cài MetaMask!");
        return;
      }

      setIsConnecting(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signerInstance = await provider.getSigner();
      const address = await signerInstance.getAddress();

      setSigner(signerInstance);
      setWalletAddress(address);
      return { address, signer: signerInstance };
    } catch (error) {
      console.error("Connect wallet error:", error);
    } finally {
      setIsConnecting(false);
    }
  };
  const disconnectWallet = () => {
    setWalletAddress(null);
    setSigner(null);
  };
  return (
    <Web3Context.Provider
      value={{
        walletAddress,
        isConnecting,
        connectWallet,
        disconnectWallet,
        signer,
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
