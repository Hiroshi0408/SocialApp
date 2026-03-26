import axios from "./axios";

const web3Service = {
  getNonce: async (walletAddress) => {
    const response = await axios.get(`/web3/nonce/${walletAddress}`);
    return response.data;
  },

  walletLogin: async (walletAddress, signature, message) => {
    const response = await axios.post("/web3/wallet-login", {
      walletAddress,
      signature,
      message,
    });
    if (response.data.success && response.data.token) {
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
    }
    return response.data;
  },

  linkWallet: async (walletAddress, signature, message) => {
    const response = await axios.post("/web3/link-wallet", {
      walletAddress,
      signature,
      message,
    });
    return response.data;
  },
};

export default web3Service;
