const Group = require("../models/Group");

class GroupDAO {
  async findById(id) {
    return await Group.findById(id);
  }

  async findWithCreator(id) {
    return await Group.findById(id).populate("creator", "_id username fullName avatar").lean();
  }

  async findMany(filter, options = {}) {
    const { sort = { createdAt: -1 }, limit = 20, populate = "" } = options;
    let query = Group.find(filter).sort(sort).limit(limit);
    if (populate) query = query.populate(populate);
    return await query.lean();
  }

  async create(data) {
    return await Group.create(data);
  }

  async save(group) {
    return await group.save();
  }

  async deleteById(id) {
    return await Group.findByIdAndDelete(id);
  }
}

module.exports = new GroupDAO();
