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

  // Hash nội dung post — 2 version để phân biệt post cũ/mới (phương án không migrate):
  //   v1 (legacy, post cũ): { caption, image, video, createdAt }
  //   v2 (post mới):        { v: "v2", authorId, caption, image, video, createdAt }
  // Vì sao có authorId trong hash v2: BE trả gas nên msg.sender luôn là ví BE,
  // không thể dùng `owner` on-chain để prove tác giả. Cho authorId vào hash = cách
  // duy nhất để ràng buộc "ai là người đăng" vào content đã register.
  computeContentHash(post, { version = "v2", authorId = null } = {}) {
    const createdAt =
      post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt;

    if (version === "v1") {
      const raw = JSON.stringify({
        caption: post.caption || "",
        image: post.image || "",
        video: post.video || "",
        createdAt,
      });
      return ethers.keccak256(ethers.toUtf8Bytes(raw));
    }

    // v2 (default cho post mới)
    const raw = JSON.stringify({
      v: "v2",
      authorId: authorId ? authorId.toString() : "",
      caption: post.caption || "",
      image: post.image || "",
      video: post.video || "",
      createdAt,
    });
    return ethers.keccak256(ethers.toUtf8Bytes(raw));
  }

  // Gọi registerPost trên Sepolia — BE trả gas
  // Luôn dùng hash v2 (kèm authorId) cho post mới. Trả về { contentHash, txHash, blockNumber, version }
  async registerPost(postId, post, authorId) {
    const version = "v2";
    const contentHash = this.computeContentHash(post, { version, authorId });

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
        version,
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
  // Tự detect version từ post.onChain.version — post cũ (null) dùng v1, post mới dùng v2.
  // Trả về { match, version, onChainData, offChainHash }
  async verifyPost(postId, post) {
    try {
      const contract = this._getReadOnlyContract();
      const onChainPost = await contract.verifyPost(postId.toString());

      // post.userId có thể là ObjectId hoặc object đã populate — lấy _id nếu có
      const version = post.onChain?.version || "v1";
      const authorId =
        version === "v2"
          ? post.userId?._id || post.userId
          : null;

      const offChainHash = this.computeContentHash(post, { version, authorId });
      const onChainHash = onChainPost.contentHash;

      return {
        match: onChainHash === offChainHash,
        version,
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
