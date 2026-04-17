const mongoose = require("mongoose");

const nonceSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
  },
  nonce: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300,
  },
});

module.exports = mongoose.model("Nonce", nonceSchema);
