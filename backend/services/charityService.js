const { ethers } = require("ethers");
const blockchainService = require("./blockchainService");
const campaignDAO = require("../dao/campaignDAO");
const donationDAO = require("../dao/donationDAO");
const organizationDAO = require("../dao/organizationDAO");
const userDAO = require("../dao/userDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const {
  CHARITY_STATUS_NAMES,
  MAX_CHARITY_MILESTONES,
  MIN_CAMPAIGN_DURATION_DAYS,
  MAX_CAMPAIGN_DURATION_DAYS,
  DEFAULT_CAMPAIGN_LIMIT,
  MAX_CAMPAIGN_LIMIT,
  DEFAULT_DONATION_LIMIT,
  MAX_DONATION_LIMIT,
  CHARITY_CATEGORIES,
} = require("../constants");

// ABI Human-Readable — chỉ liệt kê những gì BE thực sự gọi/đọc.
// Không import artifact để khỏi phụ thuộc đường dẫn build của hardhat.
const CHARITY_ABI = [
  // write
  "function createCampaign(uint256 goal, uint256 durationSec, uint256[] milestoneAmounts, bytes32 metadataHash) external returns (uint256)",
  "function donate(uint256 id) external payable",
  "function markFailed(uint256 id) external",
  "function claimRefund(uint256 id) external",
  "function markExecuting(uint256 id) external",
  "function unlockMilestone(uint256 id, uint256 idx) external",
  "function adminForceFail(uint256 id) external",
  "function whitelistOrg(address org) external",
  "function unwhitelistOrg(address org) external",

  // read
  "function campaigns(uint256) external view returns (address beneficiary, uint256 goal, uint256 raised, uint256 deadline, uint256 unlockedTotal, uint8 status, bytes32 metadataHash, bool exists)",
  "function getMilestones(uint256 id) external view returns (tuple(uint256 amount, bool unlocked)[])",
  "function nextCampaignId() external view returns (uint256)",

  // events
  "event CampaignCreated(uint256 indexed id, address indexed beneficiary, uint256 goal, uint256 deadline, bytes32 metadataHash)",
  "event Donated(uint256 indexed id, address indexed donor, uint256 amount, uint256 newRaised)",
  "event StatusChanged(uint256 indexed id, uint8 from, uint8 to)",
  "event MilestoneUnlocked(uint256 indexed id, uint256 indexed idx, uint256 amount)",
  "event RefundClaimed(uint256 indexed id, address indexed donor, uint256 amount)",
];

// Format campaign cho FE — flatten + ẩn metadata không cần thiết
const formatCampaign = (campaign) => {
  if (!campaign) return null;
  const obj = typeof campaign.toJSON === "function" ? campaign.toJSON() : campaign;
  return {
    id: obj._id,
    onChainId: obj.onChainId,
    onChainStatus: obj.onChainStatus,
    organizationId: obj.organizationId,
    organization: obj.organizationId && typeof obj.organizationId === "object"
      ? {
          id: obj.organizationId._id,
          name: obj.organizationId.name,
          slug: obj.organizationId.slug,
          logo: obj.organizationId.logo,
          status: obj.organizationId.status,
        }
      : undefined,
    title: obj.title,
    description: obj.description,
    coverImage: obj.coverImage,
    category: obj.category,
    beneficiary: obj.beneficiary,
    goalWei: obj.goalWei,
    raisedWei: obj.raisedWei,
    unlockedTotalWei: obj.unlockedTotalWei,
    deadline: obj.deadline,
    status: obj.status,
    milestones: (obj.milestones || []).map((m, idx) => ({
      idx,
      amountWei: m.amountWei,
      title: m.title,
      description: m.description,
      unlocked: m.unlocked,
      unlockedTxHash: m.unlockedTxHash,
      unlockedAt: m.unlockedAt,
      reportPostId: m.reportPostId,
    })),
    metadataHash: obj.metadataHash,
    createTxHash: obj.createTxHash,
    createBlockNumber: obj.createBlockNumber,
    donorsCount: obj.donorsCount,
    createdAt: obj.createdAt,
  };
};

const formatDonation = (donation) => {
  if (!donation) return null;
  const obj = typeof donation.toJSON === "function" ? donation.toJSON() : donation;
  return {
    id: obj._id,
    campaignId: obj.campaignId,
    onChainCampaignId: obj.onChainCampaignId,
    donor: obj.donor,
    donorUserId: obj.donorUserId,
    donorUser: obj.donorUserId && typeof obj.donorUserId === "object"
      ? {
          id: obj.donorUserId._id,
          username: obj.donorUserId.username,
          fullName: obj.donorUserId.fullName,
          avatar: obj.donorUserId.avatar,
        }
      : undefined,
    amountWei: obj.amountWei,
    txHash: obj.txHash,
    blockNumber: obj.blockNumber,
    donatedAt: obj.donatedAt,
    refunded: obj.refunded,
    refundTxHash: obj.refundTxHash,
    refundedAt: obj.refundedAt,
  };
};

const POPULATE_ORG = {
  path: "organizationId",
  select: "_id name slug logo status walletAddress",
};
const POPULATE_DONOR_USER = {
  path: "donorUserId",
  select: "_id username fullName avatar",
};

class CharityService {
  // ────────────── helpers ──────────────

  _getContract() {
    const address = process.env.CHARITY_ADDRESS;
    if (!address) {
      throw new AppError("CHARITY_ADDRESS is not configured", 500);
    }
    return blockchainService.getContract(address, CHARITY_ABI);
  }

  _getReadOnlyContract() {
    const address = process.env.CHARITY_ADDRESS;
    if (!address) {
      throw new AppError("CHARITY_ADDRESS is not configured", 500);
    }
    return blockchainService.getReadOnlyContract(address, CHARITY_ABI);
  }

  // Hash off-chain metadata, commit lên-chain dưới dạng bytes32.
  // v1 schema chốt ngày 2026-04-25:
  //   { v, organizationId, title, description, coverImage, category,
  //     milestones: [{ amountWei, title, description }] }
  // organizationId nhúng trong hash để chống case 1 org tạo campaign rồi org khác
  // re-deploy metadata khác giữ nguyên on-chain id (dù về lý thuyết on-chain
  // beneficiary đã ràng buộc; vẫn phòng thủ ở metadata layer).
  computeMetadataHash({ organizationId, title, description, coverImage, category, milestones }) {
    const raw = JSON.stringify({
      v: "v1",
      organizationId: organizationId.toString(),
      title: title || "",
      description: description || "",
      coverImage: coverImage || "",
      category: category || "other",
      milestones: (milestones || []).map((m) => ({
        amountWei: m.amountWei,
        title: m.title || "",
        description: m.description || "",
      })),
    });
    return ethers.keccak256(ethers.toUtf8Bytes(raw));
  }

  // contract trả status dưới dạng uint8 → map về chuỗi enum đã định nghĩa Mongo
  _statusFromChain(uint8) {
    return CHARITY_STATUS_NAMES[Number(uint8)] || "OPEN";
  }

  // Đọc full state on-chain của 1 campaign (campaigns + getMilestones)
  async _readChainState(onChainId) {
    const contract = this._getReadOnlyContract();
    const [c, ms] = await Promise.all([
      contract.campaigns(onChainId),
      contract.getMilestones(onChainId),
    ]);
    if (!c.exists) return null;
    return {
      beneficiary: c.beneficiary.toLowerCase(),
      goalWei: c.goal.toString(),
      raisedWei: c.raised.toString(),
      deadline: new Date(Number(c.deadline) * 1000),
      unlockedTotalWei: c.unlockedTotal.toString(),
      status: this._statusFromChain(c.status),
      metadataHash: c.metadataHash.toLowerCase(),
      milestonesUnlocked: ms.map((m) => Boolean(m.unlocked)),
    };
  }

  // ────────────── createCampaign (FE-signed flow) ──────────────
  //
  // Flow:
  //  1. FE call prepareCampaignCreate → BE validate, return { goalWei, durationSec,
  //     milestoneAmountsWei, metadataHash } để FE truyền vào contract.createCampaign.
  //  2. FE dùng signer ví ORG ký tx (msg.sender = ví org → beneficiary đúng + role
  //     check pass vì ví đã được admin whitelist on-chain qua organizationService.verify).
  //  3. FE call recordCampaignCreate với { ...payload, txHash } sau khi tx confirm.
  //     BE re-validate, recompute hash, fetch receipt, parse event CampaignCreated,
  //     verify hash + beneficiary khớp với ví org, lưu Mongo (onChainStatus="confirmed").
  //
  // Lý do tách 2 step thay vì BE tự call: contract `createCampaign` đặt
  // beneficiary = msg.sender + require CAMPAIGN_CREATOR_ROLE. Nếu BE wallet sign,
  // beneficiary sẽ là ví BE → milestone disburse về sai ví. Phải để org tự ký.

  // Validate + parse common — dùng cho cả prepare và record.
  // Trả về object đã parse sẵn để caller dùng ngay.
  async _validateAndParseCampaignPayload(userId, payload) {
    const {
      organizationId,
      title,
      description = "",
      coverImage = "",
      category = "other",
      goalEth,
      durationDays,
      milestones,
    } = payload;

    if (!organizationId) throw new AppError("organizationId is required", 400);
    const org = await organizationDAO.findById(organizationId);
    if (!org) throw new AppError("Organization not found", 404);
    if (org.owner.toString() !== userId.toString()) {
      throw new AppError("You are not the owner of this organization", 403);
    }
    if (org.status !== "verified") {
      throw new AppError("Organization must be verified to create a campaign", 403);
    }
    if (!org.walletAddress) {
      throw new AppError("Organization wallet address is missing", 400);
    }

    if (!title || !title.trim()) throw new AppError("Title is required", 400);
    if (!goalEth) throw new AppError("Goal is required", 400);
    if (!durationDays) throw new AppError("Duration is required", 400);
    if (!Array.isArray(milestones) || milestones.length === 0) {
      throw new AppError("At least 1 milestone is required", 400);
    }
    if (milestones.length > MAX_CHARITY_MILESTONES) {
      throw new AppError(`Maximum ${MAX_CHARITY_MILESTONES} milestones`, 400);
    }
    const days = Number(durationDays);
    if (
      !Number.isFinite(days) ||
      days < MIN_CAMPAIGN_DURATION_DAYS ||
      days > MAX_CAMPAIGN_DURATION_DAYS
    ) {
      throw new AppError(
        `Duration must be between ${MIN_CAMPAIGN_DURATION_DAYS} and ${MAX_CAMPAIGN_DURATION_DAYS} days`,
        400
      );
    }
    if (!CHARITY_CATEGORIES.includes(category)) {
      throw new AppError("Invalid category", 400);
    }

    let goalWei;
    try {
      goalWei = ethers.parseEther(String(goalEth));
    } catch {
      throw new AppError("Invalid goal value", 400);
    }
    if (goalWei <= 0n) throw new AppError("Goal must be > 0", 400);

    const milestoneAmountsWei = [];
    let sum = 0n;
    for (const [i, m] of milestones.entries()) {
      if (!m.title || !m.title.trim()) {
        throw new AppError(`Milestone ${i + 1}: title is required`, 400);
      }
      let mWei;
      try {
        mWei = ethers.parseEther(String(m.amountEth));
      } catch {
        throw new AppError(`Milestone ${i + 1}: invalid amount`, 400);
      }
      if (mWei <= 0n) throw new AppError(`Milestone ${i + 1}: amount must be > 0`, 400);
      milestoneAmountsWei.push(mWei);
      sum += mWei;
    }
    if (sum !== goalWei) {
      throw new AppError("Sum of milestones must equal goal", 400);
    }

    const milestonesEmbedded = milestones.map((m, i) => ({
      amountWei: milestoneAmountsWei[i].toString(),
      title: m.title.trim(),
      description: (m.description || "").trim(),
    }));

    const metadataHash = this.computeMetadataHash({
      organizationId: org._id,
      title: title.trim(),
      description: description.trim(),
      coverImage,
      category,
      milestones: milestonesEmbedded,
    });

    const durationSec = days * 24 * 60 * 60;

    return {
      org,
      goalWei,
      durationSec,
      milestoneAmountsWei,
      milestonesEmbedded,
      metadataHash,
      normalized: {
        title: title.trim(),
        description: description.trim(),
        coverImage,
        category,
      },
    };
  }

  // Step 1: FE call để lấy params chuẩn (BigInt → string) gửi vào contract.
  // KHÔNG tạo Mongo doc — nếu user reject ký, không có rác.
  async prepareCampaignCreate(userId, payload) {
    const parsed = await this._validateAndParseCampaignPayload(userId, payload);
    return {
      goalWei: parsed.goalWei.toString(),
      durationSec: parsed.durationSec,
      milestoneAmountsWei: parsed.milestoneAmountsWei.map((w) => w.toString()),
      metadataHash: parsed.metadataHash,
      beneficiary: parsed.org.walletAddress.toLowerCase(),
    };
  }

  // Step 2: FE call sau khi tx confirm. BE verify on-chain rồi mới lưu Mongo.
  async recordCampaignCreate(userId, payload) {
    const { txHash } = payload;
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new AppError("Invalid txHash", 400);
    }
    const txHashLower = txHash.toLowerCase();

    // Idempotent: FE retry với cùng txHash → trả doc đã có
    const existing = await campaignDAO.findByCreateTxHash(txHashLower);
    if (existing) {
      const fresh = await campaignDAO.findById(existing._id, { populate: POPULATE_ORG });
      return formatCampaign(fresh);
    }

    // Re-validate payload + parse (BE source of truth, không tin FE đã tính sẵn)
    const parsed = await this._validateAndParseCampaignPayload(userId, payload);

    // Fetch receipt + verify on-chain
    const provider = blockchainService.getProvider();
    const receipt = await provider.getTransactionReceipt(txHashLower);
    if (!receipt) {
      throw new AppError("Transaction not found or not mined yet", 404);
    }
    if (receipt.status !== 1) {
      throw new AppError("Transaction reverted on-chain", 400);
    }
    if (receipt.to?.toLowerCase() !== process.env.CHARITY_ADDRESS.toLowerCase()) {
      throw new AppError("Transaction not sent to Charity contract", 400);
    }

    // Parse event CampaignCreated
    const contract = this._getReadOnlyContract();
    const iface = contract.interface;
    const eventTopic = iface.getEvent("CampaignCreated").topicHash;
    const log = receipt.logs.find(
      (l) =>
        l.topics[0] === eventTopic &&
        l.address.toLowerCase() === process.env.CHARITY_ADDRESS.toLowerCase()
    );
    if (!log) {
      throw new AppError("CampaignCreated event not found in receipt", 400);
    }
    const evt = iface.parseLog({ topics: log.topics, data: log.data });
    const onChainId = Number(evt.args.id);
    const eventBeneficiary = evt.args.beneficiary.toLowerCase();
    const eventGoal = evt.args.goal.toString();
    const eventMetadataHash = evt.args.metadataHash.toLowerCase();

    // Strict verify: ví ký tx phải khớp ví org (anti-spoof: kẻ khác ký để spam Mongo)
    if (eventBeneficiary !== parsed.org.walletAddress.toLowerCase()) {
      throw new AppError(
        "Transaction beneficiary does not match organization wallet",
        400
      );
    }
    if (eventGoal !== parsed.goalWei.toString()) {
      throw new AppError("On-chain goal does not match payload", 400);
    }
    if (eventMetadataHash !== parsed.metadataHash.toLowerCase()) {
      throw new AppError("On-chain metadataHash does not match payload", 400);
    }

    // Đọc deadline từ chain — block timestamp khi tx mined ≠ Date.now() từ payload
    const chain = await this._readChainState(onChainId);
    if (!chain) throw new AppError("Campaign not found on-chain", 500);

    // Lưu Mongo với data verified — onChainStatus thẳng "confirmed", bỏ qua "pending"
    let campaign;
    try {
      campaign = await campaignDAO.create({
        organizationId: parsed.org._id,
        createdBy: userId,
        title: parsed.normalized.title,
        description: parsed.normalized.description,
        coverImage: parsed.normalized.coverImage,
        category: parsed.normalized.category,
        beneficiary: parsed.org.walletAddress,
        goalWei: parsed.goalWei.toString(),
        deadline: chain.deadline,
        milestones: parsed.milestonesEmbedded,
        metadataHash: parsed.metadataHash.toLowerCase(),
        onChainId,
        onChainStatus: "confirmed",
        createTxHash: txHashLower,
        createBlockNumber: receipt.blockNumber,
      });
    } catch (err) {
      // Race: 2 record call cùng lúc (cùng txHash) → unique onChainId trip
      if (err.code === 11000) {
        const dup = await campaignDAO.findByCreateTxHash(txHashLower);
        if (dup) {
          const fresh = await campaignDAO.findById(dup._id, { populate: POPULATE_ORG });
          return formatCampaign(fresh);
        }
      }
      throw err;
    }

    // Sync cache (raised/unlocked vẫn 0 ngay sau create nhưng ghi cho chuẩn)
    await campaignDAO.syncChainCache(campaign._id, {
      raisedWei: chain.raisedWei,
      unlockedTotalWei: chain.unlockedTotalWei,
      status: chain.status,
    });

    await organizationDAO.incrementCampaigns(parsed.org._id);

    logger.info(
      `Charity: campaign recorded — id=${campaign._id}, onChainId=${onChainId}, tx=${txHashLower}`
    );

    const fresh = await campaignDAO.findById(campaign._id, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // ────────────── list / detail ──────────────

  async listCampaigns(query = {}) {
    const {
      status,
      category,
      organizationId,
      page: rawPage = 1,
      limit: rawLimit = DEFAULT_CAMPAIGN_LIMIT,
      sort: rawSort = "newest",
    } = query;

    const limit = Math.min(parseInt(rawLimit, 10) || DEFAULT_CAMPAIGN_LIMIT, MAX_CAMPAIGN_LIMIT);
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;

    // mặc định chỉ list confirmed — pending/failed là noise
    const filter = { onChainStatus: "confirmed" };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (organizationId) filter.organizationId = organizationId;

    let sort;
    if (rawSort === "ending-soon") sort = { deadline: 1 };
    else if (rawSort === "most-funded") sort = { donorsCount: -1, createdAt: -1 };
    else sort = { createdAt: -1 }; // newest

    const [campaigns, total] = await Promise.all([
      campaignDAO.findMany(filter, {
        limit,
        skip,
        sort,
        populate: POPULATE_ORG,
        lean: true,
      }),
      campaignDAO.count(filter),
    ]);

    return {
      campaigns: campaigns.map(formatCampaign),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listMyCampaigns(userId, query = {}) {
    // Lấy org của user (active = pending/verified) rồi list theo org
    const org = await organizationDAO.findOne(
      { owner: userId, status: { $in: ["pending", "verified"] } },
      { lean: true }
    );
    if (!org) {
      return {
        campaigns: [],
        pagination: { page: 1, limit: DEFAULT_CAMPAIGN_LIMIT, total: 0, totalPages: 0 },
      };
    }
    return this.listCampaigns({ ...query, organizationId: org._id });
  }

  async getCampaignDetail(id, { forceSync = false } = {}) {
    const campaign = await campaignDAO.findById(id, { populate: POPULATE_ORG });
    if (!campaign) throw new AppError("Campaign not found", 404);

    if (forceSync && campaign.onChainId !== null && campaign.onChainStatus === "confirmed") {
      try {
        const chain = await this._readChainState(campaign.onChainId);
        if (chain) {
          // Chỉ sync số cache (raised/unlocked/status). milestone.unlocked +
          // unlockedTxHash + reportPostId do BE tự set khi gọi unlockMilestone
          // qua service (Day 9), không lấy từ chain ở đây để tránh ghi đè meta.
          await campaignDAO.syncChainCache(campaign._id, {
            raisedWei: chain.raisedWei,
            unlockedTotalWei: chain.unlockedTotalWei,
            status: chain.status,
          });
        }
      } catch (err) {
        logger.warn(`Charity: forceSync failed for ${id}: ${err.message}`);
        // không throw — vẫn trả cache cũ
      }
    }

    const fresh = await campaignDAO.findById(id, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // ────────────── recordDonation ──────────────

  // FE gọi sau khi user ký donate thành công, gửi { onChainCampaignId, txHash }
  // BE tự fetch receipt + parse event Donated để verify, không tin số FE gửi.
  async recordDonation(userId, payload) {
    const { onChainCampaignId, txHash } = payload;
    if (onChainCampaignId === undefined || onChainCampaignId === null) {
      throw new AppError("onChainCampaignId is required", 400);
    }
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new AppError("Invalid txHash", 400);
    }
    const txHashLower = txHash.toLowerCase();

    // Idempotent: nếu đã record rồi, trả luôn record cũ
    const existing = await donationDAO.findByTxHash(txHashLower);
    if (existing) {
      return formatDonation(existing);
    }

    // Lookup campaign theo onChainId
    const campaign = await campaignDAO.findByOnChainId(Number(onChainCampaignId));
    if (!campaign) throw new AppError("Campaign not found", 404);

    // Fetch receipt + parse event Donated
    const provider = blockchainService.getProvider();
    const receipt = await provider.getTransactionReceipt(txHashLower);
    if (!receipt) {
      throw new AppError("Transaction not found or not mined yet", 404);
    }
    if (receipt.status !== 1) {
      throw new AppError("Transaction reverted on-chain", 400);
    }
    // Verify tx được gửi tới đúng contract Charity
    if (receipt.to?.toLowerCase() !== process.env.CHARITY_ADDRESS.toLowerCase()) {
      throw new AppError("Transaction not sent to Charity contract", 400);
    }

    const contract = this._getReadOnlyContract();
    const iface = contract.interface;
    const eventTopic = iface.getEvent("Donated").topicHash;
    const log = receipt.logs.find(
      (l) =>
        l.topics[0] === eventTopic &&
        l.address.toLowerCase() === process.env.CHARITY_ADDRESS.toLowerCase()
    );
    if (!log) {
      throw new AppError("Donated event not found in transaction", 400);
    }
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    const eventCampaignId = Number(parsed.args.id);
    const eventDonor = parsed.args.donor.toLowerCase();
    const eventAmountWei = parsed.args.amount.toString();

    // Strict — event campaignId phải khớp với param
    if (eventCampaignId !== Number(onChainCampaignId)) {
      throw new AppError("Event campaignId mismatch", 400);
    }

    // Donor wallet — từ event, là nguồn sự thật. donorUserId optional (link nếu user
    // đã link wallet với account này, hoặc bất kỳ user nào đã link ví đó)
    let donorUserId = null;
    if (userId) {
      // Ưu tiên: user đang đăng nhập mà ví khớp event donor
      const me = await userDAO.findById(userId, {
        select: "walletAddress",
        lean: true,
      });
      if (me?.walletAddress?.toLowerCase() === eventDonor) {
        donorUserId = userId;
      }
    }
    if (!donorUserId) {
      // Fallback: tìm user nào có ví khớp (donate qua MetaMask không cần login)
      const linked = await userDAO.findOne(
        { walletAddress: eventDonor },
        { select: "_id", lean: true }
      );
      if (linked) donorUserId = linked._id;
    }

    // Check donor mới hay cũ TRƯỚC khi insert (race con bỏ qua theo thỏa thuận)
    const isNewDonor = !(await donationDAO.findOneByDonor(campaign._id, eventDonor));

    // Insert — rely unique index txHash để chống double-insert
    let donation;
    try {
      donation = await donationDAO.create({
        campaignId: campaign._id,
        onChainCampaignId: Number(onChainCampaignId),
        donor: eventDonor,
        donorUserId,
        amountWei: eventAmountWei,
        txHash: txHashLower,
        blockNumber: receipt.blockNumber,
        donatedAt: new Date(),
      });
    } catch (err) {
      if (err.code === 11000) {
        // race rare: doc bên kia chèn xong trước, return existing
        const dup = await donationDAO.findByTxHash(txHashLower);
        return formatDonation(dup);
      }
      throw err;
    }

    // Sync raised/status từ chain (nguồn sự thật) thay vì tự cộng BigInt
    try {
      const chain = await this._readChainState(campaign.onChainId);
      if (chain) {
        await campaignDAO.syncChainCache(campaign._id, {
          raisedWei: chain.raisedWei,
          unlockedTotalWei: chain.unlockedTotalWei,
          status: chain.status,
        });
      }
    } catch (err) {
      logger.warn(`Charity: syncChainCache after donation failed: ${err.message}`);
    }

    if (isNewDonor) {
      await campaignDAO.incrementDonorsCount(campaign._id, 1);
    }

    logger.info(
      `Charity: donation recorded — campaign=${campaign._id}, donor=${eventDonor}, amount=${eventAmountWei}, tx=${txHashLower}`
    );

    return formatDonation(donation);
  }

  async listDonations(campaignId, query = {}) {
    const campaign = await campaignDAO.findById(campaignId, { lean: true });
    if (!campaign) throw new AppError("Campaign not found", 404);

    const {
      page: rawPage = 1,
      limit: rawLimit = DEFAULT_DONATION_LIMIT,
    } = query;
    const limit = Math.min(parseInt(rawLimit, 10) || DEFAULT_DONATION_LIMIT, MAX_DONATION_LIMIT);
    const page = Math.max(parseInt(rawPage, 10) || 1, 1);
    const skip = (page - 1) * limit;

    const [donations, total] = await Promise.all([
      donationDAO.findManyByCampaign(campaign._id, {
        limit,
        skip,
        populate: POPULATE_DONOR_USER,
        lean: true,
      }),
      donationDAO.count({ campaignId: campaign._id }),
    ]);

    return {
      donations: donations.map(formatDonation),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ────────────── operator / admin actions ──────────────

  // Chuyển campaign FUNDED → EXECUTING (BE wallet gọi contract)
  async markExecuting(campaignId, adminUserId) {
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.onChainId === null || campaign.onChainStatus !== "confirmed") {
      throw new AppError("Campaign is not confirmed on-chain", 400);
    }
    if (campaign.status !== "FUNDED") {
      throw new AppError(`Campaign must be FUNDED to mark executing (current: ${campaign.status})`, 400);
    }

    const contract = this._getContract();
    let txHash = null;
    try {
      const tx = await contract.markExecuting(campaign.onChainId);
      txHash = tx.hash;
      logger.info(`Charity markExecuting tx=${txHash}, campaign=${campaignId}, admin=${adminUserId}`);
      const receipt = await tx.wait();
      logger.info(`Charity markExecuting confirmed block=${receipt.blockNumber}`);
    } catch (err) {
      logger.error(`Charity markExecuting on-chain failed: ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to markExecuting on-chain", 502);
    }

    await campaignDAO.updateStatus(campaignId, "EXECUTING");
    const fresh = await campaignDAO.findById(campaignId, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // Unlock 1 milestone — operator action sau khi admin xác nhận report
  // reportPostId là _id của Post báo cáo (phải thuộc org owner)
  async unlockMilestone(campaignId, milestoneIdx, reportPostId, adminUserId) {
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.onChainId === null || campaign.onChainStatus !== "confirmed") {
      throw new AppError("Campaign is not confirmed on-chain", 400);
    }
    if (campaign.status !== "EXECUTING") {
      throw new AppError(`Campaign must be EXECUTING (current: ${campaign.status})`, 400);
    }

    const idx = Number(milestoneIdx);
    if (!Number.isFinite(idx) || idx < 0 || idx >= campaign.milestones.length) {
      throw new AppError("Invalid milestone index", 400);
    }
    if (campaign.milestones[idx].unlocked) {
      throw new AppError("Milestone already unlocked", 400);
    }

    // Validate reportPostId nếu cung cấp
    if (reportPostId) {
      const Post = require("../models/Post");
      const post = await Post.findById(reportPostId).select("_id author").lean();
      if (!post) throw new AppError("Report post not found", 404);
      // Lấy org để check author là owner
      const org = await organizationDAO.findById(campaign.organizationId, { lean: true });
      if (post.author.toString() !== org?.owner?.toString()) {
        throw new AppError("Report post must be authored by the organization owner", 403);
      }
    }

    const contract = this._getContract();
    let txHash = null;
    let blockNumber = null;
    try {
      const tx = await contract.unlockMilestone(campaign.onChainId, idx);
      txHash = tx.hash;
      logger.info(`Charity unlockMilestone tx=${txHash}, campaign=${campaignId}, idx=${idx}, admin=${adminUserId}`);
      const receipt = await tx.wait();
      blockNumber = receipt.blockNumber;
      logger.info(`Charity unlockMilestone confirmed block=${blockNumber}`);
    } catch (err) {
      logger.error(`Charity unlockMilestone on-chain failed: ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to unlockMilestone on-chain", 502);
    }

    await campaignDAO.markMilestoneUnlocked(campaignId, idx, {
      txHash,
      reportPostId: reportPostId || null,
    });

    // Sync chain cache (unlockedTotal + status — nếu milestone cuối → COMPLETED)
    try {
      const chain = await this._readChainState(campaign.onChainId);
      if (chain) {
        await campaignDAO.syncChainCache(campaignId, {
          raisedWei: chain.raisedWei,
          unlockedTotalWei: chain.unlockedTotalWei,
          status: chain.status,
        });
      }
    } catch (err) {
      logger.warn(`Charity: syncChainCache after unlockMilestone failed: ${err.message}`);
    }

    const fresh = await campaignDAO.findById(campaignId, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // Force fail — admin dùng khi phát hiện gian lận (FUNDED hoặc EXECUTING)
  async adminForceFail(campaignId, adminUserId) {
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.onChainId === null || campaign.onChainStatus !== "confirmed") {
      throw new AppError("Campaign is not confirmed on-chain", 400);
    }
    if (!["FUNDED", "EXECUTING"].includes(campaign.status)) {
      throw new AppError(`Cannot force-fail campaign with status ${campaign.status}`, 400);
    }
    // Contract reject khi đã unlock milestone (unlockedTotal > 0). Fail-fast ở BE
    // để khỏi tốn gas estimate + tx revert. Cache có thể stale nên cũng sync chain
    // trước khi quyết — vẫn giữ guard này như defense-in-depth.
    if (campaign.unlockedTotalWei && BigInt(campaign.unlockedTotalWei) > 0n) {
      throw new AppError(
        "Cannot force-fail after a milestone has been disbursed",
        400
      );
    }

    const contract = this._getContract();
    let txHash = null;
    try {
      // adminForceFail chưa có trong ABI human-readable — dùng tên function đúng contract
      const tx = await contract.adminForceFail(campaign.onChainId);
      txHash = tx.hash;
      logger.info(`Charity adminForceFail tx=${txHash}, campaign=${campaignId}, admin=${adminUserId}`);
      const receipt = await tx.wait();
      logger.info(`Charity adminForceFail confirmed block=${receipt.blockNumber}`);
    } catch (err) {
      logger.error(`Charity adminForceFail on-chain failed: ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to adminForceFail on-chain", 502);
    }

    await campaignDAO.updateStatus(campaignId, "FAILED");
    const fresh = await campaignDAO.findById(campaignId, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // Whitelist 1 org wallet trên contract (gọi sau khi admin verify org)
  async whitelistOrgOnChain(orgId) {
    const org = await organizationDAO.findById(orgId);
    if (!org) throw new AppError("Organization not found", 404);
    if (!org.walletAddress) throw new AppError("Organization has no wallet address", 400);

    const contract = this._getContract();
    let txHash = null;
    let blockNumber = null;
    try {
      const tx = await contract.whitelistOrg(org.walletAddress);
      txHash = tx.hash;
      logger.info(`Charity whitelistOrg tx=${txHash}, org=${orgId}, wallet=${org.walletAddress}`);
      const receipt = await tx.wait();
      blockNumber = receipt.blockNumber;
      logger.info(`Charity whitelistOrg confirmed block=${blockNumber}`);
    } catch (err) {
      logger.error(`Charity whitelistOrg on-chain failed: ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to whitelist org on-chain", 502);
    }

    await organizationDAO.updateById(orgId, {
      "onChain.whitelistTxHash": txHash,
      "onChain.whitelistBlockNumber": blockNumber,
      "onChain.whitelistedAt": new Date(),
    });

    logger.info(`Charity whitelistOrg done — org=${orgId}, wallet=${org.walletAddress}`);
  }

  // ────────────── markFailedIfExpired ──────────────

  // Public endpoint — ai cũng gọi được sau khi deadline qua để đánh dấu FAILED.
  // Contract markFailed() cũng là public, nên BE chỉ cần verify điều kiện rồi relay.
  async markFailedIfExpired(campaignId) {
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.onChainId === null || campaign.onChainStatus !== "confirmed") {
      throw new AppError("Campaign is not confirmed on-chain", 400);
    }
    if (campaign.status !== "OPEN") {
      throw new AppError(`Campaign is not OPEN (current: ${campaign.status})`, 400);
    }
    if (new Date() < new Date(campaign.deadline)) {
      throw new AppError("Campaign deadline has not passed yet", 400);
    }
    // So sánh BigInt string — raised < goal
    if (BigInt(campaign.raisedWei) >= BigInt(campaign.goalWei)) {
      throw new AppError("Campaign has already met its goal", 400);
    }

    const contract = this._getContract();
    let txHash = null;
    try {
      const tx = await contract.markFailed(campaign.onChainId);
      txHash = tx.hash;
      logger.info(`Charity markFailed tx=${txHash}, campaign=${campaignId}`);
      const receipt = await tx.wait();
      logger.info(`Charity markFailed confirmed block=${receipt.blockNumber}`);
    } catch (err) {
      logger.error(`Charity markFailed on-chain failed: ${err.message}`);
      if (err instanceof AppError) throw err;
      throw new AppError("Failed to markFailed on-chain", 502);
    }

    await campaignDAO.updateStatus(campaignId, "FAILED");
    const fresh = await campaignDAO.findById(campaignId, { populate: POPULATE_ORG });
    return formatCampaign(fresh);
  }

  // ────────────── recordRefund ──────────────

  // FE gọi sau khi user ký claimRefund tx thành công, gửi { onChainCampaignId, txHash }.
  // BE fetch receipt + parse RefundClaimed event để verify, sau đó cập nhật Donation doc.
  async recordRefund(userId, payload) {
    const { onChainCampaignId, txHash } = payload;
    if (onChainCampaignId === undefined || onChainCampaignId === null) {
      throw new AppError("onChainCampaignId is required", 400);
    }
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      throw new AppError("Invalid txHash", 400);
    }
    const txHashLower = txHash.toLowerCase();

    // Idempotent: nếu đã record rồi thì trả luôn donation đó
    const existing = await donationDAO.findByRefundTxHash(txHashLower);
    if (existing) return formatDonation(existing);

    // Lookup campaign
    const campaign = await campaignDAO.findByOnChainId(Number(onChainCampaignId));
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.status !== "FAILED") {
      throw new AppError("Campaign is not in FAILED state", 400);
    }

    // Fetch receipt
    const provider = blockchainService.getProvider();
    const receipt = await provider.getTransactionReceipt(txHashLower);
    if (!receipt) throw new AppError("Transaction not found or not mined yet", 404);
    if (receipt.status !== 1) throw new AppError("Transaction reverted on-chain", 400);
    if (receipt.to?.toLowerCase() !== process.env.CHARITY_ADDRESS.toLowerCase()) {
      throw new AppError("Transaction not sent to Charity contract", 400);
    }

    // Parse RefundClaimed event
    const contract = this._getReadOnlyContract();
    const iface = contract.interface;
    const eventTopic = iface.getEvent("RefundClaimed").topicHash;
    const log = receipt.logs.find(
      (l) =>
        l.topics[0] === eventTopic &&
        l.address.toLowerCase() === process.env.CHARITY_ADDRESS.toLowerCase()
    );
    if (!log) throw new AppError("RefundClaimed event not found in transaction", 400);

    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    const eventCampaignId = Number(parsed.args.id);
    const eventDonor = parsed.args.donor.toLowerCase();
    const eventAmountWei = parsed.args.amount.toString();

    if (eventCampaignId !== Number(onChainCampaignId)) {
      throw new AppError("Event campaignId mismatch", 400);
    }

    // On-chain claimRefund gom TOÀN BỘ contribution của donor (1 lần kéo hết).
    // Nếu donor có nhiều donation docs (donate nhiều lần) → cache phải mark hết,
    // không chỉ 1 doc, để FE list hiển thị đúng và idempotent guard không skip
    // các doc còn lại ở lần call sau.
    const unrefunded = await donationDAO.findUnrefundedByDonor(campaign._id, eventDonor);
    if (unrefunded.length === 0) {
      // Hoặc donor chưa từng donate, hoặc đã refund hết → idempotent: trả doc đầu nếu có
      const any = await donationDAO.findOneByDonor(campaign._id, eventDonor);
      if (!any) throw new AppError("No donation record found for this donor", 404);
      return formatDonation(any);
    }

    await donationDAO.markManyRefunded(
      unrefunded.map((d) => d._id),
      txHashLower
    );

    logger.info(
      `Charity: refund recorded — campaign=${campaign._id}, donor=${eventDonor}, amount=${eventAmountWei}, tx=${txHashLower}, marked=${unrefunded.length}`
    );

    // Trả về doc đầu tiên (representative) — FE chỉ cần biết refund đã thành công
    const fresh = await donationDAO.findById(unrefunded[0]._id);
    return formatDonation(fresh);
  }

  // Force sync 1 campaign từ chain (admin/cron, hoặc gọi nội bộ qua getCampaignDetail)
  async syncFromChain(campaignId) {
    const campaign = await campaignDAO.findById(campaignId);
    if (!campaign) throw new AppError("Campaign not found", 404);
    if (campaign.onChainId === null || campaign.onChainStatus !== "confirmed") {
      throw new AppError("Campaign is not confirmed on-chain yet", 400);
    }
    const chain = await this._readChainState(campaign.onChainId);
    if (!chain) throw new AppError("Campaign not found on-chain", 404);

    await campaignDAO.syncChainCache(campaign._id, {
      raisedWei: chain.raisedWei,
      unlockedTotalWei: chain.unlockedTotalWei,
      status: chain.status,
    });

    return {
      onChain: chain,
      cache: {
        raisedWei: campaign.raisedWei,
        unlockedTotalWei: campaign.unlockedTotalWei,
        status: campaign.status,
      },
      synced: true,
    };
  }
}

module.exports = new CharityService();
