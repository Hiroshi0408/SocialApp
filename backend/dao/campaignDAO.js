const Campaign = require("../models/Campaign");

const ACTIVE_FILTER = { deleted: { $ne: true } };

class CampaignDAO {
  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Campaign.findOne({ _id: id, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findByCreateTxHash(txHash, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Campaign.findOne({ createTxHash: txHash, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findByOnChainId(onChainId, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Campaign.findOne({ onChainId, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findOne(filter, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Campaign.findOne({ ...filter, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findMany(filter = {}, options = {}) {
    const {
      select = "",
      populate = "",
      lean = false,
      sort = { createdAt: -1 },
      limit = 20,
      skip = 0,
    } = options;

    let query = Campaign.find({ ...filter, ...ACTIVE_FILTER })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async count(filter = {}) {
    return await Campaign.countDocuments({ ...filter, ...ACTIVE_FILTER });
  }

  async create(data) {
    return await Campaign.create(data);
  }

  // Gọi 1 lần sau khi tx createCampaign confirm on-chain
  async updateOnChainMeta(id, { onChainId, createTxHash, createBlockNumber, onChainStatus }) {
    const update = {};
    if (onChainId !== undefined) update.onChainId = onChainId;
    if (createTxHash !== undefined) update.createTxHash = createTxHash;
    if (createBlockNumber !== undefined) update.createBlockNumber = createBlockNumber;
    if (onChainStatus !== undefined) update.onChainStatus = onChainStatus;
    return await Campaign.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
  }

  // Ghi đè counter cache từ on-chain state — đây là nguồn sự thật duy nhất
  // cho raisedWei / unlockedTotalWei, tránh tự cộng BigInt trong code.
  async syncChainCache(id, { raisedWei, unlockedTotalWei, status }) {
    const update = {};
    if (raisedWei !== undefined) update.raisedWei = raisedWei;
    if (unlockedTotalWei !== undefined) update.unlockedTotalWei = unlockedTotalWei;
    if (status !== undefined) update.status = status;
    return await Campaign.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
  }

  async updateStatus(id, status) {
    return await Campaign.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );
  }

  // Mark 1 milestone unlocked — update nested sub-doc bằng positional dot path
  async markMilestoneUnlocked(id, idx, { txHash, reportPostId = null }) {
    const update = {
      [`milestones.${idx}.unlocked`]: true,
      [`milestones.${idx}.unlockedTxHash`]: txHash,
      [`milestones.${idx}.unlockedAt`]: new Date(),
    };
    if (reportPostId) update[`milestones.${idx}.reportPostId`] = reportPostId;
    return await Campaign.findByIdAndUpdate(id, update, { new: true });
  }

  // delta = 1 khi donor lần đầu, 0 nếu donor đã có trong Donation trước đó
  async incrementDonorsCount(id, delta = 1) {
    if (!delta) return null;
    return await Campaign.findByIdAndUpdate(
      id,
      { $inc: { donorsCount: delta } },
      { new: true }
    );
  }

  async softDeleteById(id) {
    return await Campaign.findByIdAndUpdate(
      id,
      { deleted: true, deletedAt: new Date() },
      { new: true }
    );
  }

  // Đếm số campaign theo (org, status) cho admin dashboard track record.
  // 1 query aggregate cho nhiều org → tránh N+1. Chỉ tính campaign đã confirmed
  // on-chain (pending/failed register là noise, không phản ánh hoạt động thật).
  async aggregateStatusCountsByOrg(orgIds = []) {
    if (!Array.isArray(orgIds) || orgIds.length === 0) return {};
    const mongoose = require("mongoose");
    const objectIds = orgIds.map((id) =>
      typeof id === "string" || !id?._bsontype
        ? new mongoose.Types.ObjectId(id)
        : id
    );
    const rows = await Campaign.aggregate([
      {
        $match: {
          organizationId: { $in: objectIds },
          onChainStatus: "confirmed",
          deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: { org: "$organizationId", status: "$status" },
          count: { $sum: 1 },
        },
      },
    ]);
    const out = {};
    const empty = () => ({
      OPEN: 0,
      FUNDED: 0,
      EXECUTING: 0,
      COMPLETED: 0,
      FAILED: 0,
      REFUNDED: 0,
      total: 0,
    });
    for (const id of objectIds) out[id.toString()] = empty();
    for (const row of rows) {
      const key = row._id.org.toString();
      if (!out[key]) out[key] = empty();
      const status = row._id.status || "OPEN";
      if (status in out[key]) out[key][status] = row.count;
      out[key].total += row.count;
    }
    return out;
  }
}

module.exports = new CampaignDAO();
