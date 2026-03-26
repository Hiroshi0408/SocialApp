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

module.exports = router;
