const { ethers } = require("ethers");
const crypto = require("crypto");
const userDAO = require("../dao/userDAO");
const Nonce = require("../models/Nonce");
const AppError = require("../utils/AppError");
const { generateToken, generateRandomString } = require("../helpers/generate");
const logger = require("../utils/logger");

class Web3Service {
  // Tạo nonce mới và lưu vào MongoDB — overwrite nếu địa chỉ đã có nonce cũ
  async generateNonce(walletAddress) {
    if (!ethers.isAddress(walletAddress)) {
      throw new AppError("Invalid wallet address", 400);
    }

    const nonce = crypto.randomBytes(32).toString("hex");
    const normalizedAddress = walletAddress.toLowerCase();

    await Nonce.findOneAndUpdate(
      { walletAddress: normalizedAddress },
      { walletAddress: normalizedAddress, nonce, createdAt: new Date() },
      { upsert: true }
    );

    return "Login to SocialApp: " + nonce;
  }

  // Verify nonce + signature rồi xóa nonce (single-use) — dùng chung cho login và link
  async _verifyAndConsumeNonce(walletAddress, message, signature) {
    const normalizedAddress = walletAddress.toLowerCase();

    const storedNonce = await Nonce.findOne({ walletAddress: normalizedAddress });
    if (!storedNonce) {
      throw new AppError("Nonce expired or not found. Please request a new nonce.", 400);
    }

    const expectedMessage = "Login to SocialApp: " + storedNonce.nonce;
    if (message !== expectedMessage) {
      throw new AppError("Message does not match issued nonce", 400);
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    logger.info("Wallet verify — recovered:", recoveredAddress, "expected:", walletAddress);

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      throw new AppError("Invalid signature", 401);
    }

    // Xóa nonce sau khi dùng một lần — tránh replay attack
    await Nonce.deleteOne({ walletAddress: normalizedAddress });
  }

  async walletLogin(walletAddress, signature, message) {
    await this._verifyAndConsumeNonce(walletAddress, message, signature);

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
    return { token, user };
  }

  async linkWallet(userId, walletAddress, signature, message) {
    await this._verifyAndConsumeNonce(walletAddress, message, signature);

    const existingUser = await userDAO.findByWalletAddress(walletAddress);
    if (existingUser && existingUser._id.toString() !== userId) {
      throw new AppError("Wallet already linked to another account", 400);
    }

    const updatedUser = await userDAO.updateById(userId, {
      walletAddress: walletAddress.toLowerCase(),
    });
    return updatedUser;
  }

  async unlinkWallet(userId) {
    // $unset xóa field hoàn toàn — sparse index cho phép nhiều user không có walletAddress
    const updatedUser = await userDAO.updateById(userId, {
      $unset: { walletAddress: "" },
    });
    return updatedUser;
  }
}

module.exports = new Web3Service();
