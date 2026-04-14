const groupDAO = require("../dao/groupDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const formatGroup = (group) => ({
  id: group._id,
  name: group.name,
  description: group.description,
  image: group.image,
  members: group.membersCount || group.members?.length || 0,
  creator: group.creator,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const POPULATE_CREATOR = { path: "creator", select: "_id username fullName avatar" };

class GroupService {
  async getJoinedGroups(userId) {
    const groups = await groupDAO.findMany(
      { members: userId },
      { sort: { updatedAt: -1 }, populate: POPULATE_CREATOR }
    );
    return groups.map(formatGroup);
  }

  async getSuggestedGroups(userId, query = {}) {
    const limit = Math.min(parseInt(query.limit, 10) || 10, 50);
    const groups = await groupDAO.findMany(
      { members: { $ne: userId } },
      { sort: { createdAt: -1 }, limit, populate: POPULATE_CREATOR }
    );
    return groups.map(formatGroup);
  }

  async createGroup(creatorId, data) {
    const { name, description = "", image = "" } = data;

    if (!name || !name.trim()) throw new AppError("Group name is required", 400);

    const group = await groupDAO.create({
      name: name.trim(),
      description: description.trim(),
      image: image.trim(),
      creator: creatorId,
      members: [creatorId],
      membersCount: 1,
    });

    const populated = await groupDAO.findWithCreator(group._id);
    logger.info(`Group created - ID: ${group._id}`);
    return formatGroup(populated);
  }

  async joinGroup(userId, groupId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const alreadyMember = group.members.some((id) => id.toString() === userId.toString());
    if (alreadyMember) {
      const populated = await groupDAO.findWithCreator(groupId);
      return { group: formatGroup(populated), alreadyMember: true };
    }

    group.members.push(userId);
    group.membersCount = group.members.length;
    await groupDAO.save(group);

    const populated = await groupDAO.findWithCreator(groupId);
    return { group: formatGroup(populated), alreadyMember: false };
  }

  async leaveGroup(userId, groupId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    group.members = group.members.filter((id) => id.toString() !== userId.toString());

    if (group.members.length === 0) {
      await groupDAO.deleteById(groupId);
      return { deleted: true };
    }

    group.membersCount = group.members.length;
    await groupDAO.save(group);
    return { deleted: false };
  }
}

module.exports = new GroupService();
