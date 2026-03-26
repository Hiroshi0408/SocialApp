const User = require("../models/User");
const { ethers } = require("ethers");
const crypto = require("crypto");
const logger = require("../utils/logger");
const { generateToken, generateRandomString } = require("../helpers/generate");
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
    const recoveredAddress = ethers.verifyMessage(message, signature);
    logger.info("recovered:", recoveredAddress);
    logger.info("expected:", walletAddress);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }

    let user = await User.findOne({ walletAddress });

    if (!user) {
      const username = "user_" + generateRandomString(8);

      user = new User({
        username,
        fullName: "Wallet User",
        walletAddress,
      });
      await user.save({ validateBeforeSave: false });
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
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        message: "Invalid signature",
      });
    }
    const userId = req.user.id;
    const user = await User.findById(userId);

    const existingUser = await User.findOne({ walletAddress });
    if (existingUser && existingUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: "Wallet already linked to another account",
      });
    }

    user.walletAddress = walletAddress;

    await user.save();
    res.json({ success: true, message: "Wallet connected" });
  } catch (error) {
    logger.error("Error linking wallet:", error.message);
    res.status(500).json({ success: false, message: "Failed to link wallet" });
  }
};
