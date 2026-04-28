const Organization = require("../models/Organization");

const ACTIVE_FILTER = { deleted: { $ne: true } };

class OrganizationDAO {
  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Organization.findOne({ _id: id, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findOne(filter, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Organization.findOne({ ...filter, ...ACTIVE_FILTER });
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async findBySlug(slug, options = {}) {
    return this.findOne({ slug: slug.toLowerCase() }, options);
  }

  async findByWallet(walletAddress, options = {}) {
    return this.findOne({ walletAddress: walletAddress.toLowerCase() }, options);
  }

  async findMany(filter, options = {}) {
    const {
      select = "",
      populate = "",
      lean = false,
      sort = { createdAt: -1 },
      limit = 20,
      skip = 0,
    } = options;

    let query = Organization.find({ ...filter, ...ACTIVE_FILTER })
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query.exec();
  }

  async count(filter = {}) {
    return await Organization.countDocuments({ ...filter, ...ACTIVE_FILTER });
  }

  async create(data) {
    return await Organization.create(data);
  }

  async updateById(id, data) {
    return await Organization.findByIdAndUpdate(
      id,
      data,
      { new: true, runValidators: true }
    );
  }

  async softDeleteById(id) {
    return await Organization.findByIdAndUpdate(
      id,
      { deleted: true, deletedAt: new Date() },
      { new: true }
    );
  }

  async incrementCampaigns(id) {
    return await Organization.findByIdAndUpdate(
      id,
      { $inc: { campaignsCount: 1 } },
      { new: true }
    );
  }
}

module.exports = new OrganizationDAO();
