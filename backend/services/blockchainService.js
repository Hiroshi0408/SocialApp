const { ethers } = require("ethers");
const logger = require("../utils/logger");

class BlockchainService {
  constructor() {
    this._provider = null;
    this._signer = null;
  }

  // Lazy-init provider — tránh crash khi khởi động nếu SEPOLIA_RPC_URL chưa set
  getProvider() {
    if (!this._provider) {
      const rpcUrl = process.env.SEPOLIA_RPC_URL;
      if (!rpcUrl) {
        throw new Error("SEPOLIA_RPC_URL is not set in environment variables");
      }
      this._provider = new ethers.JsonRpcProvider(rpcUrl);
      logger.info("BlockchainService: Sepolia provider initialized");
    }
    return this._provider;
  }

  // Lazy-init signer — ví BE dùng để ký các tx hệ thống (BE trả gas)
  getSigner() {
    if (!this._signer) {
      const privateKey = process.env.BE_WALLET_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error("BE_WALLET_PRIVATE_KEY is not set in environment variables");
      }
      this._signer = new ethers.Wallet(privateKey, this.getProvider());
      logger.info("BlockchainService: BE signer initialized, address:", this._signer.address);
    }
    return this._signer;
  }

  // Load contract instance với signer (dùng khi cần gọi write function)
  getContract(address, abi) {
    return new ethers.Contract(address, abi, this.getSigner());
  }

  // Load contract instance với provider (dùng khi chỉ cần read/view function)
  getReadOnlyContract(address, abi) {
    return new ethers.Contract(address, abi, this.getProvider());
  }
}

module.exports = new BlockchainService();
