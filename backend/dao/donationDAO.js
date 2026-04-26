const Donation = require("../models/Donation");

class DonationDAO {
  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Donation.findById(id);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findByTxHash(txHash) {
    return await Donation.findOne({ txHash: txHash.toLowerCase() });
  }

  async findByRefundTxHash(refundTxHash) {
    return await Donation.findOne({ refundTxHash: refundTxHash.toLowerCase() });
  }

  // Check donor đã donate campaign này chưa → quyết định có tăng donorsCount không
  async findOneByDonor(campaignId, donor) {
    return await Donation.findOne({
      campaignId,
      donor: donor.toLowerCase(),
    });
  }

  async findManyByCampaign(campaignId, options = {}) {
    const {
      select = "",
      populate = "",
      lean = false,
      sort = { donatedAt: -1 },
      limit = 20,
      skip = 0,
    } = options;

    let query = Donation.find({ campaignId })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findManyByDonor(donor, options = {}) {
    const {
      select = "",
      populate = "",
      lean = false,
      sort = { donatedAt: -1 },
      limit = 20,
      skip = 0,
    } = options;

    let query = Donation.find({ donor: donor.toLowerCase() })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async count(filter = {}) {
    return await Donation.countDocuments(filter);
  }

  async create(data) {
    return await Donation.create(data);
  }

  async markRefunded(id, refundTxHash) {
    return await Donation.findByIdAndUpdate(
      id,
      {
        refunded: true,
        refundTxHash: refundTxHash.toLowerCase(),
        refundedAt: new Date(),
      },
      { new: true }
    );
  }
}

module.exports = new DonationDAO();
