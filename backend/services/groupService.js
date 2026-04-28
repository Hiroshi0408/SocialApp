const groupDAO = require("../dao/groupDAO");
const postDAO = require("../dao/postDAO");
const organizationDAO = require("../dao/organizationDAO");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");

const formatGroup = (group) => ({
  id: group._id,
  name: group.name,
  description: group.description,
  image: group.image,
  members: group.membersCount || group.members?.length || 0,
  creator: group.creator,
  organizationId: group.organizationId || null,
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

// Format cho detail page — giữ lại mảng members đã populate để FE render tab Members
const formatGroupDetail = (group, viewerId) => {
  const creatorId =
    group.creator?._id?.toString?.() || group.creator?.toString?.();
  const viewerIdStr = viewerId?.toString();
  const isMember = (group.members || []).some(
    (m) => (m._id?.toString?.() || m.toString()) === viewerIdStr,
  );

  return {
    id: group._id,
    name: group.name,
    description: group.description,
    image: group.image,
    creator: group.creator,
    membersCount: group.membersCount || group.members?.length || 0,
    membersList: group.members || [],
    organizationId: group.organizationId || null,
    isMember,
    isCreator: creatorId === viewerIdStr,
    isOfficial: !!group.organizationId,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};

const POPULATE_CREATOR = {
  path: "creator",
  select: "_id username fullName avatar",
};

class GroupService {
  async getJoinedGroups(userId) {
    const groups = await groupDAO.findMany(
      { members: userId },
      { sort: { updatedAt: -1 }, populate: POPULATE_CREATOR },
    );
    return groups.map(formatGroup);
  }

  async getSuggestedGroups(userId, query = {}) {
    const limit = Math.min(parseInt(query.limit, 10) || 10, 50);
    const groups = await groupDAO.findMany(
      { members: { $ne: userId } },
      { sort: { createdAt: -1 }, limit, populate: POPULATE_CREATOR },
    );
    return groups.map(formatGroup);
  }

  async getGroupById(userId, groupId) {
    const group = await groupDAO.findByIdWithMembers(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const detail = formatGroupDetail(group, userId);

    // Attach organizationSlug nếu là official group — FE dùng để deep-link sang
    // /org/:slug mà không cần list toàn bộ organizations
    if (detail.organizationId) {
      const org = await organizationDAO.findById(detail.organizationId, {
        select: "slug",
        lean: true,
      });
      detail.organizationSlug = org?.slug || null;
    }
    return detail;
  }

  async createGroup(creatorId, data) {
    const { name, description = "", image = "" } = data;

    if (!name || !name.trim())
      throw new AppError("Group name is required", 400);

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

  async updateGroup(userId, groupId, data) {
    const group = await groupDAO.findById(groupId, { lean: true });
    if (!group) throw new AppError("Group not found", 404);

    if (group.creator.toString() !== userId.toString()) {
      throw new AppError("Only the group creator can update this group", 403);
    }

    const patch = {};
    if (data.name !== undefined) {
      if (!data.name.trim()) throw new AppError("Group name is required", 400);
      patch.name = data.name.trim();
    }
    if (data.description !== undefined) {
      patch.description = (data.description || "").trim();
    }
    if (data.image !== undefined) patch.image = (data.image || "").trim();

    await groupDAO.updateById(groupId, patch);
    const updated = await groupDAO.findByIdWithMembers(groupId);
    logger.info(`Group updated - id=${groupId}, user=${userId}`);
    return formatGroupDetail(updated, userId);
  }

  async deleteGroup(userId, groupId) {
    const group = await groupDAO.findById(groupId, { lean: true });
    if (!group) throw new AppError("Group not found", 404);

    if (group.creator.toString() !== userId.toString()) {
      throw new AppError("Only the group creator can delete this group", 403);
    }

    // Group official thuộc Organization — không cho xoá tay, phải xoá qua
    // luồng Organization để đồng bộ state 2 bên (Group.organizationId ↔ Org.groupId)
    if (group.organizationId) {
      throw new AppError(
        "Official organization groups cannot be deleted directly",
        400,
      );
    }

    // Cascade: soft-delete mọi post trong group để counter postsCount của owner
    // không bị ảnh hưởng âm (không decrement vì giữ "history"), nhưng post không
    // còn xuất hiện ở bất kỳ feed/search nào. User thấy group biến mất là đủ.
    await postDAO.softDeleteMany({ groupId });
    await groupDAO.deleteById(groupId);
    logger.info(`Group deleted - id=${groupId}, user=${userId}`);
    return { deleted: true };
  }

  async joinGroup(userId, groupId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const alreadyMember = group.members.some(
      (id) => id.toString() === userId.toString(),
    );
    if (alreadyMember) {
      const populated = await groupDAO.findWithCreator(groupId);
      return { group: formatGroup(populated), alreadyMember: true };
    }

    await groupDAO.updateById(groupId, {
      $push: { members: userId },
      $inc: { membersCount: 1 },
    });

    const populated = await groupDAO.findWithCreator(groupId);
    return { group: formatGroup(populated), alreadyMember: false };
  }

  async leaveGroup(userId, groupId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    const isCreator = group.creator.toString() === userId.toString();
    const remaining = group.members.filter(
      (id) => id.toString() !== userId.toString(),
    );

    // Creator không được leave khi còn member khác — phải transfer ownership trước.
    // Tránh trạng thái group "mồ côi" không ai admin.
    if (isCreator && remaining.length > 0) {
      throw new AppError(
        "Creator must transfer ownership before leaving the group",
        400,
      );
    }

    if (remaining.length === 0) {
      if (group.organizationId) {
        throw new AppError(
          "Official organization groups cannot be emptied",
          400,
        );
      }
      await groupDAO.deleteById(groupId);
      return { deleted: true };
    }

    await groupDAO.updateById(groupId, {
      $pull: { members: userId },
      $set: { membersCount: remaining.length },
    });
    return { deleted: false };
  }

  async kickMember(userId, groupId, targetUserId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    if (group.creator.toString() !== userId.toString()) {
      throw new AppError("Only the group creator can kick members", 403);
    }
    if (targetUserId.toString() === userId.toString()) {
      throw new AppError("Creator cannot kick themselves", 400);
    }

    const isMember = group.members.some(
      (id) => id.toString() === targetUserId.toString(),
    );
    if (!isMember) throw new AppError("User is not a member of this group", 404);

    await groupDAO.updateById(groupId, {
      $pull: { members: targetUserId },
      $inc: { membersCount: -1 },
    });

    logger.info(
      `Group member kicked - group=${groupId}, target=${targetUserId}, by=${userId}`,
    );
    return { kicked: true };
  }

  async transferOwnership(userId, groupId, targetUserId) {
    const group = await groupDAO.findById(groupId);
    if (!group) throw new AppError("Group not found", 404);

    if (group.creator.toString() !== userId.toString()) {
      throw new AppError(
        "Only the current creator can transfer ownership",
        403,
      );
    }
    if (targetUserId.toString() === userId.toString()) {
      throw new AppError("Cannot transfer ownership to yourself", 400);
    }

    const isMember = group.members.some(
      (id) => id.toString() === targetUserId.toString(),
    );
    if (!isMember) {
      throw new AppError("Target user is not a member of this group", 400);
    }

    await groupDAO.updateById(groupId, { creator: targetUserId });
    const updated = await groupDAO.findByIdWithMembers(groupId);

    logger.info(
      `Group ownership transferred - group=${groupId}, from=${userId}, to=${targetUserId}`,
    );
    return formatGroupDetail(updated, userId);
  }
}

module.exports = new GroupService();
