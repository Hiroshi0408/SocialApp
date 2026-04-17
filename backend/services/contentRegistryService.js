const { ethers } = require("ethers");
const blockchainService = require("./blockchainService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// ABI chỉ cần 2 function đang dùng — không import cả file artifact cho gọn
const CONTENT_REGISTRY_ABI = [
  "function registerPost(string postId, bytes32 contentHash) external",
  "function verifyPost(string postId) external view returns (tuple(bytes32 contentHash, address owner, uint256 timestamp, bool exists))",
];

class ContentRegistryService {
  _getContract() {
    const address = process.env.CONTENT_REGISTRY_ADDRESS;
    if (!address) {
      throw new AppError("CONTENT_REGISTRY_ADDRESS is not configured", 500);
    }
    return blockchainService.getContract(address, CONTENT_REGISTRY_ABI);
  }

  _getReadOnlyContract() {
    const address = process.env.CONTENT_REGISTRY_ADDRESS;
    if (!address) {
      throw new AppError("CONTENT_REGISTRY_ADDRESS is not configured", 500);
    }
    return blockchainService.getReadOnlyContract(address, CONTENT_REGISTRY_ABI);
  }

  // Hash nội dung post theo cùng 1 cách ở cả registerPost và verifyPost
  // để đảm bảo so sánh hash về sau luôn nhất quán
  // Dùng caption + image + video + createdAt — đủ để detect nếu content bị sửa
  computeContentHash(post) {
    const raw = JSON.stringify({
      caption: post.caption || "",
      image: post.image || "",
      video: post.video || "",
      createdAt: post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt,
    });
    return ethers.keccak256(ethers.toUtf8Bytes(raw));
  }

  // Gọi registerPost trên Sepolia — BE trả gas
  // Trả về { contentHash, txHash, blockNumber }
  async registerPost(postId, post) {
    const contentHash = this.computeContentHash(post);

    try {
      const contract = this._getContract();
      const tx = await contract.registerPost(postId.toString(), contentHash);
      logger.info(`ContentRegistry: registerPost tx sent — postId=${postId}, tx=${tx.hash}`);

      const receipt = await tx.wait();
      logger.info(`ContentRegistry: confirmed — postId=${postId}, block=${receipt.blockNumber}`);

      return {
        contentHash,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err) {
      // Contract revert "Post ID already exists" → coi như đã register, không crash
      if (err.reason === "Post ID already exists") {
        logger.warn(`ContentRegistry: postId=${postId} already registered on-chain`);
        throw new AppError("Post already registered on-chain", 409);
      }
      logger.error("ContentRegistry: registerPost failed:", err.message);
      throw new AppError("Failed to register post on-chain", 500);
    }
  }

  // Gọi verifyPost on-chain, tính lại hash từ Mongo rồi so sánh
  // Trả về { match, onChainData, offChainHash }
  async verifyPost(postId, post) {
    try {
      const contract = this._getReadOnlyContract();
      const onChainPost = await contract.verifyPost(postId.toString());

      const offChainHash = this.computeContentHash(post);
      const onChainHash = onChainPost.contentHash;

      return {
        match: onChainHash === offChainHash,
        onChainData: {
          contentHash: onChainHash,
          owner: onChainPost.owner,
          // timestamp từ contract là BigInt (seconds) → convert sang ms
          timestamp: new Date(Number(onChainPost.timestamp) * 1000).toISOString(),
          blockNumber: null, // verifyPost không trả blockNumber, dùng txHash từ Mongo nếu cần
        },
        offChainHash,
      };
    } catch (err) {
      if (err.reason === "Post does not exist") {
        throw new AppError("Post not registered on-chain", 404);
      }
      logger.error("ContentRegistry: verifyPost failed:", err.message);
      throw new AppError("Failed to verify post on-chain", 500);
    }
  }
}

module.exports = new ContentRegistryService();
