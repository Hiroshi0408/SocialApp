const web3Service = require("../services/web3Service");
const contentRegistryService = require("../services/contentRegistryService");
const postService = require("../services/postService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

// [GET] /api/web3/nonce/:walletAddress
exports.getNonce = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    const message = await web3Service.generateNonce(walletAddress);
    res.json({ message });
  } catch (error) {
    logger.error("Error generating nonce:", error.message);
    next(error);
  }
};

// [POST] /api/web3/wallet-login
exports.walletLogin = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;
    const { token, user } = await web3Service.walletLogin(walletAddress, signature, message);
    res.json({ success: true, token, user });
  } catch (error) {
    logger.error("Error logging in with wallet:", error.message);
    next(error);
  }
};

// [POST] /api/web3/link-wallet
exports.linkWallet = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;
    const user = await web3Service.linkWallet(req.user.id, walletAddress, signature, message);
    res.json({ success: true, message: "Wallet connected", user });
  } catch (error) {
    logger.error("Error linking wallet:", error.message);
    next(error);
  }
};

// [DELETE] /api/web3/link-wallet
exports.unlinkWallet = async (req, res, next) => {
  try {
    const user = await web3Service.unlinkWallet(req.user.id);
    res.json({ success: true, message: "Wallet unlinked", user });
  } catch (error) {
    logger.error("Error unlinking wallet:", error.message);
    next(error);
  }
};

// [GET] /api/web3/posts/:postId/verify
exports.verifyPost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    // Lấy post từ Mongo để tính lại off-chain hash
    // getPostById throw AppError 404 nếu không tìm thấy
    const post = await postService.getPostById(postId, null);

    if (!post.onChain || !post.onChain.registered) {
      return next(new AppError("Post is not registered on-chain", 400));
    }

    const result = await contentRegistryService.verifyPost(postId, post);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error("Error verifying post on-chain:", error.message);
    next(error);
  }
};
