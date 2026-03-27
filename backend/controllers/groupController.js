const mongoose = require("mongoose");
const Group = require("../models/Group");
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

exports.getJoinedGroups = async (req, res) => {
  try {
    const userId = req.user.id;

    const groups = await Group.find({ members: userId })
      .populate("creator", "_id username fullName avatar")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      groups: groups.map(formatGroup),
    });
  } catch (error) {
    logger.error("Get joined groups error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load joined groups",
    });
  }
};

exports.getSuggestedGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

    const groups = await Group.find({ members: { $ne: userId } })
      .populate("creator", "_id username fullName avatar")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      success: true,
      groups: groups.map(formatGroup),
    });
  } catch (error) {
    logger.error("Get suggested groups error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load suggested groups",
    });
  }
};

exports.createGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description = "", image = "" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      image: image.trim(),
      creator: userId,
      members: [userId],
      membersCount: 1,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("creator", "_id username fullName avatar")
      .lean();

    res.status(201).json({
      success: true,
      group: formatGroup(populatedGroup),
    });
  } catch (error) {
    logger.error("Create group error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create group",
    });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    const alreadyMember = group.members.some(
      (memberId) => memberId.toString() === userId.toString(),
    );

    if (alreadyMember) {
      return res.json({
        success: true,
        group: formatGroup(group.toObject()),
      });
    }

    group.members.push(userId);
    group.membersCount = group.members.length;
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate("creator", "_id username fullName avatar")
      .lean();

    res.json({
      success: true,
      group: formatGroup(populatedGroup),
    });
  } catch (error) {
    logger.error("Join group error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to join group",
    });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group id",
      });
    }

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found",
      });
    }

    group.members = group.members.filter(
      (memberId) => memberId.toString() !== userId.toString(),
    );

    if (group.members.length === 0) {
      await group.deleteOne();
      return res.json({
        success: true,
        deleted: true,
      });
    }

    group.membersCount = group.members.length;
    await group.save();

    res.json({
      success: true,
      deleted: false,
    });
  } catch (error) {
    logger.error("Leave group error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to leave group",
    });
  }
};
