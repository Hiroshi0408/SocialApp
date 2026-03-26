const mongoose = require("mongoose");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Friendship = require("../models/Friendship");
const { createNotification } = require("./notificationController");
const { DEFAULT_USER_LIMIT, MAX_USER_LIMIT } = require("../constants");
const logger = require("../utils/logger.js");

const buildFriendPair = (userId1, userId2) => {
  const a = userId1.toString();
  const b = userId2.toString();
  return a < b
    ? { userA: userId1, userB: userId2 }
    : { userA: userId2, userB: userId1 };
};

const getFriendshipStatus = async (currentUserId, otherUserId) => {
  const pair = buildFriendPair(currentUserId, otherUserId);

  const [friendship, outgoingRequest, incomingRequest] = await Promise.all([
    Friendship.findOne(pair).select("_id"),
    FriendRequest.findOne({
      fromUserId: currentUserId,
      toUserId: otherUserId,
      status: "pending",
    }).select("_id"),
    FriendRequest.findOne({
      fromUserId: otherUserId,
      toUserId: currentUserId,
      status: "pending",
    }).select("_id"),
  ]);

  if (friendship) {
    return {
      status: "friends",
      isFriend: true,
      hasOutgoingRequest: false,
      hasIncomingRequest: false,
    };
  }

  if (outgoingRequest) {
    return {
      status: "outgoing_request",
      isFriend: false,
      hasOutgoingRequest: true,
      hasIncomingRequest: false,
    };
  }

  if (incomingRequest) {
    return {
      status: "incoming_request",
      isFriend: false,
      hasOutgoingRequest: false,
      hasIncomingRequest: true,
    };
  }

  return {
    status: "none",
    isFriend: false,
    hasOutgoingRequest: false,
    hasIncomingRequest: false,
  };
};

// [POST] /api/friends/requests/:userId
exports.sendFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    logger.info(`Send friend request - From: ${currentUserId}, To: ${userId}`);

    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: "Cannot send friend request to yourself",
      });
    }

    const targetUser = await User.findOne({
      _id: userId,
      deleted: false,
      status: "active",
    }).select("_id");

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const pair = buildFriendPair(currentUserId, userId);
    const existingFriendship = await Friendship.findOne(pair).select("_id");

    if (existingFriendship) {
      return res.status(400).json({
        success: false,
        message: "You are already friends",
      });
    }

    const incomingRequest = await FriendRequest.findOne({
      fromUserId: userId,
      toUserId: currentUserId,
      status: "pending",
    });

    if (incomingRequest) {
      return res.status(400).json({
        success: false,
        message: "This user already sent you a friend request",
      });
    }

    const existingRequest = await FriendRequest.findOne({
      fromUserId: currentUserId,
      toUserId: userId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Friend request already sent",
      });
    }

    const request = new FriendRequest({
      fromUserId: currentUserId,
      toUserId: userId,
      status: "pending",
    });

    await request.save();

    await createNotification({
      recipientId: userId,
      senderId: currentUserId,
      type: "friend_request",
      targetType: "user",
      targetId: currentUserId,
    });

    res.json({
      success: true,
      message: "Friend request sent",
    });
  } catch (error) {
    logger.error("Send friend request error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Friend request already sent",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send friend request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [DELETE] /api/friends/requests/:userId
exports.cancelFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const deletedRequest = await FriendRequest.findOneAndDelete({
      fromUserId: currentUserId,
      toUserId: userId,
      status: "pending",
    });

    if (!deletedRequest) {
      return res.status(404).json({
        success: false,
        message: "No pending friend request to cancel",
      });
    }

    res.json({
      success: true,
      message: "Friend request canceled",
    });
  } catch (error) {
    logger.error("Cancel friend request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel friend request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [POST] /api/friends/requests/:userId/accept
exports.acceptFriendRequest = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    session.startTransaction();

    const request = await FriendRequest.findOne({
      fromUserId: userId,
      toUserId: currentUserId,
      status: "pending",
    }).session(session);

    if (!request) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "No pending friend request found",
      });
    }

    const pair = buildFriendPair(currentUserId, userId);
    const existingFriendship = await Friendship.findOne(pair).session(session);

    if (!existingFriendship) {
      await Friendship.create(
        [
          {
            ...pair,
          },
        ],
        { session },
      );

      await Promise.all([
        User.findByIdAndUpdate(
          currentUserId,
          { $inc: { friendsCount: 1 } },
          { session },
        ),
        User.findByIdAndUpdate(
          userId,
          { $inc: { friendsCount: 1 } },
          { session },
        ),
      ]);
    }

    request.status = "accepted";
    request.respondedAt = new Date();
    await request.save({ session });

    await FriendRequest.updateMany(
      {
        status: "pending",
        $or: [
          { fromUserId: currentUserId, toUserId: userId },
          { fromUserId: userId, toUserId: currentUserId },
        ],
      },
      {
        $set: {
          status: "canceled",
          respondedAt: new Date(),
        },
      },
      { session },
    );

    await session.commitTransaction();

    await createNotification({
      recipientId: userId,
      senderId: currentUserId,
      type: "friend_accept",
      targetType: "user",
      targetId: currentUserId,
    });

    res.json({
      success: true,
      message: "Friend request accepted",
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Accept friend request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept friend request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};

// [POST] /api/friends/requests/:userId/reject
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const request = await FriendRequest.findOneAndUpdate(
      {
        fromUserId: userId,
        toUserId: currentUserId,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          respondedAt: new Date(),
        },
      },
      { new: true },
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "No pending friend request found",
      });
    }

    res.json({
      success: true,
      message: "Friend request rejected",
    });
  } catch (error) {
    logger.error("Reject friend request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject friend request",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [DELETE] /api/friends/:userId
exports.unfriendUser = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;
    const pair = buildFriendPair(currentUserId, userId);

    session.startTransaction();

    const friendship = await Friendship.findOneAndDelete(pair, { session });

    if (!friendship) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "You are not friends with this user",
      });
    }

    await Promise.all([
      User.findByIdAndUpdate(
        currentUserId,
        [
          {
            $set: {
              friendsCount: {
                $max: [0, { $subtract: ["$friendsCount", 1] }],
              },
            },
          },
        ],
        { session },
      ),
      User.findByIdAndUpdate(
        userId,
        [
          {
            $set: {
              friendsCount: {
                $max: [0, { $subtract: ["$friendsCount", 1] }],
              },
            },
          },
        ],
        { session },
      ),
    ]);

    await session.commitTransaction();

    res.json({
      success: true,
      message: "Friend removed successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error("Unfriend user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove friend",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await session.endSession();
  }
};

// [GET] /api/friends
exports.getFriends = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    const friendships = await Friendship.find({
      $or: [{ userA: currentUserId }, { userB: currentUserId }],
    })
      .populate("userA", "username fullName avatar friendsCount")
      .populate("userB", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const friends = friendships
      .map((relation) =>
        relation.userA && relation.userA._id.toString() === currentUserId
          ? relation.userB
          : relation.userA,
      )
      .filter(Boolean);

    const total = await Friendship.countDocuments({
      $or: [{ userA: currentUserId }, { userB: currentUserId }],
    });

    res.json({
      success: true,
      users: friends,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + friends.length < total,
      },
    });
  } catch (error) {
    logger.error("Get friends error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get friends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/friends/requests/incoming
exports.getIncomingFriendRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      toUserId: currentUserId,
      status: "pending",
    })
      .populate("fromUserId", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const users = requests.map((item) => item.fromUserId).filter(Boolean);
    const total = await FriendRequest.countDocuments({
      toUserId: currentUserId,
      status: "pending",
    });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    logger.error("Get incoming friend requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get incoming friend requests",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/friends/requests/outgoing
exports.getOutgoingFriendRequests = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT,
    );
    const skip = (page - 1) * limit;

    const requests = await FriendRequest.find({
      fromUserId: currentUserId,
      status: "pending",
    })
      .populate("toUserId", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const users = requests.map((item) => item.toUserId).filter(Boolean);
    const total = await FriendRequest.countDocuments({
      fromUserId: currentUserId,
      status: "pending",
    });

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + users.length < total,
      },
    });
  } catch (error) {
    logger.error("Get outgoing friend requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get outgoing friend requests",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// [GET] /api/friends/:userId/status
exports.getFriendshipStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.json({
        success: true,
        status: "self",
        isFriend: false,
        hasOutgoingRequest: false,
        hasIncomingRequest: false,
      });
    }

    const targetUser = await User.findById(userId).select("_id");
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const status = await getFriendshipStatus(currentUserId, userId);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    logger.error("Get friendship status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get friendship status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.resolveFriendshipStatus = getFriendshipStatus;
