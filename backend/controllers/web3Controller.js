const web3Service = require("../services/web3Service");
const contentRegistryService = require("../services/contentRegistryService");
const postService = require("../services/postService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

function getVerifyCandidates(post, postId) {
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (candidate) => {
    if (!candidate?.registryPostId) return;
    if (seen.has(candidate.registryPostId)) {
      const index = candidates.findIndex(
        (item) => item.registryPostId === candidate.registryPostId,
      );
      if (index >= 0) {
        candidates[index] = {
          ...candidate,
          ...candidates[index],
          snapshot: candidates[index].snapshot || candidate.snapshot || null,
          registeredAt:
            candidates[index].registeredAt || candidate.registeredAt || null,
          contentHash: candidates[index].contentHash || candidate.contentHash,
          txHash: candidates[index].txHash || candidate.txHash,
          blockNumber: candidates[index].blockNumber || candidate.blockNumber,
        };
      }
      return;
    }
    seen.add(candidate.registryPostId);
    candidates.push(candidate);
  };

  const onChain = post.onChain || {};
  pushCandidate({
    revision: onChain.revision || 1,
    registryPostId: onChain.registryPostId || postId,
    version: onChain.version,
    contentHash: onChain.contentHash,
    txHash: onChain.txHash,
    blockNumber: onChain.blockNumber,
  });

  const revisions = Array.isArray(onChain.revisions)
    ? [...onChain.revisions].sort((a, b) => (b.revision || 0) - (a.revision || 0))
    : [];

  revisions.forEach((revision) => pushCandidate(revision));

  if (candidates.length === 0) {
    pushCandidate({ revision: 1, registryPostId: postId });
  }

  return candidates;
}

function buildRevisionHistory(candidates) {
  return [...candidates]
    .sort((a, b) => (a.revision || 0) - (b.revision || 0))
    .map((item) => ({
      revision: item.revision || 1,
      registryPostId: item.registryPostId,
      version: item.version,
      contentHash: item.contentHash,
      txHash: item.txHash,
      blockNumber: item.blockNumber,
      registeredAt: item.registeredAt,
      snapshot: item.snapshot || null,
    }));
}

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

    const candidates = getVerifyCandidates(post, postId);
    const revisionHistory = buildRevisionHistory(candidates);
    let latestResult = null;

    for (const candidate of candidates) {
      const result = await contentRegistryService.verifyPost(
        candidate.registryPostId,
        post,
        { version: candidate.version },
      );
      const resultWithRevision = {
        ...result,
        matchedRevision: {
          revision: candidate.revision || 1,
          registryPostId: candidate.registryPostId,
          version: candidate.version,
          txHash: candidate.txHash,
          blockNumber: candidate.blockNumber,
          snapshot: candidate.snapshot || null,
        },
        revisions: revisionHistory,
      };

      if (!latestResult) latestResult = resultWithRevision;
      if (result.match) {
        return res.json({ success: true, ...resultWithRevision });
      }
    }

    res.json({ success: true, ...latestResult });
  } catch (error) {
    logger.error("Error verifying post on-chain:", error.message);
    next(error);
  }
};

// [POST] /api/web3/posts/:postId/stamp
exports.stampPost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const post = await postService.stampPostOnChain(postId, req.user.id);

    res.json({
      success: true,
      message: "Post revision is being stamped on-chain",
      post: { ...post.toJSON(), user: post.userId },
    });
  } catch (error) {
    logger.error("Error stamping post on-chain:", error.message);
    next(error);
  }
};
