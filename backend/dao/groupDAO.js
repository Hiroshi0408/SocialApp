const Group = require("../models/Group");

class GroupDAO {
  async findById(id, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Group.findById(id);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query;
  }

  async findOne(filter, options = {}) {
    const { select = "", populate = "", lean = false } = options;
    let query = Group.findOne(filter);
    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    if (lean) query = query.lean();
    return await query;
  }

  async findWithCreator(id) {
    return await Group.findById(id)
      .populate("creator", "_id username fullName avatar")
      .lean();
  }

  // Trả full info kèm members populated — dùng cho GroupDetail page
  async findByIdWithMembers(id) {
    return await Group.findById(id)
      .populate("creator", "_id username fullName avatar")
      .populate("members", "_id username fullName avatar")
      .lean();
  }

  async findMany(filter, options = {}) {
    const { sort = { createdAt: -1 }, skip = 0, limit = 20, populate = "" } = options;
    let query = Group.find(filter).sort(sort).skip(skip).limit(limit);
    if (populate) query = query.populate(populate);
    return await query.lean();
  }

  async create(data) {
    return await Group.create(data);
  }

  async updateById(id, data, options = {}) {
    const { runValidators = true } = options;
    return await Group.findByIdAndUpdate(id, data, { new: true, runValidators });
  }

  async deleteById(id) {
    return await Group.findByIdAndDelete(id);
  }

  async isMember(groupId, userId) {
    const group = await Group.findOne(
      { _id: groupId, members: userId },
      { _id: 1 },
    ).lean();
    return !!group;
  }
}

module.exports = new GroupDAO();
