const userDAO = require("../dao/userDAO");
const { ethers } = require("ethers");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { generateToken, generateRandomString } = require("../helpers/generate");

// Lưu nonce tạm trong memory: walletAddress -> { nonce, expiresAt }
// Nonce hết hạn sau 5 phút để tránh replay attack
const nonceStore = new Map();

// Dọn expired nonces định kỳ (mỗi 10 phút)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of nonceStore.entries()) {
    if (value.expiresAt < now) nonceStore.delete(key);
  }
}, 10 * 60 * 1000);

// [GET] /api/web3/nonce/:walletAddress
exports.getNonce = async (req, res) => {
  try {
    const { walletAddress } = req.params;
    if (!ethers.isAddress(walletAddress)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid wallet address" });
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    // Lưu nonce 5 phút — overwrite nếu đã có (user request nonce mới)
    nonceStore.set(walletAddress.toLowerCase(), {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    res.json({ message: "Login to SocialApp: " + nonce });
  } catch (error) {
    logger.error("Error generating nonce: " + error.message);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
};

// [POST] /api/web3/wallet-login
exports.walletLogin = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;
    logger.info("walletLogin data:", {
      walletAddress,
      message,
      signature: signature?.slice(0, 20),
    });

    // Verify nonce: message phải khớp với nonce do server cấp
    const stored = nonceStore.get(walletAddress?.toLowerCase());
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Nonce expired or not found. Please request a new nonce.",
      });
    }
    const expectedMessage = "Login to SocialApp: " + stored.nonce;
    if (message !== expectedMessage) {
      return res.status(400).json({
        success: false,
        message: "Message does not match issued nonce",
      });
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    logger.info("recovered:", recoveredAddress);
    logger.info("expected:", walletAddress);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // Xóa nonce sau khi dùng — tránh replay attack
    nonceStore.delete(walletAddress.toLowerCase());

    let user = await userDAO.findByWalletAddress(walletAddress);

    if (!user) {
      const username = "user_" + generateRandomString(8);
      user = await userDAO.createWalletUser({
        username,
        fullName: "Wallet User",
        walletAddress,
      });
    }

    const token = generateToken(user._id, user.username);
    res.json({ success: true, token, user: user.toJSON() });
  } catch (error) {
    logger.error("Error logging in with wallet: " + error.message);
    res.status(400).json({ error: "Failed to login with wallet" });
  }
};

// [POST] /api/web3/link-wallet
exports.linkWallet = async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body;

    // Verify nonce trước khi verify signature
    const stored = nonceStore.get(walletAddress?.toLowerCase());
    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Nonce expired or not found. Please request a new nonce.",
      });
    }
    const expectedMessage = "Login to SocialApp: " + stored.nonce;
    if (message !== expectedMessage) {
      return res.status(400).json({
        success: false,
        message: "Message does not match issued nonce",
      });
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // Xóa nonce sau khi dùng
    nonceStore.delete(walletAddress.toLowerCase());

    const userId = req.user.id;
    const existingUser = await userDAO.findByWalletAddress(walletAddress);
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: "Wallet already linked to another account",
      });
    }

    await userDAO.updateById(userId, { walletAddress: walletAddress.toLowerCase() });
    res.json({ success: true, message: "Wallet connected" });
  } catch (error) {
    logger.error("Error linking wallet:", error.message);
    res.status(500).json({ success: false, message: "Failed to link wallet" });
  }
};
