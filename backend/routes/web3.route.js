const express = require("express");
const router = express.Router();
const web3Controller = require("../controllers/web3Controller");
const {
  walletLoginValidation,
} = require("../middlewares/validation.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

router.get("/nonce/:walletAddress", web3Controller.getNonce);
router.post("/wallet-login", walletLoginValidation, web3Controller.walletLogin);
router.post(
  "/link-wallet",
  authMiddleware,
  walletLoginValidation,
  web3Controller.linkWallet,
);
router.delete("/link-wallet", authMiddleware, web3Controller.unlinkWallet);

// Public — không cần auth, ai cũng verify được
router.get("/posts/:postId/verify", web3Controller.verifyPost);

module.exports = router;
