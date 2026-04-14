const FriendRequest = require("../models/FriendRequest");
const Friendship = require("../models/Friendship");

// Canonical pair: luôn sort userId nhỏ hơn vào userA
const buildPair = (userId1, userId2) => {
  const a = userId1.toString();
  const b = userId2.toString();
  return a < b
    ? { userA: userId1, userB: userId2 }
    : { userA: userId2, userB: userId1 };
};

class FriendDAO {
  // ==================== FRIEND REQUEST ====================

  async findRequest(senderId, receiverId) {
    return await FriendRequest.findOne({
      fromUserId: senderId,
      toUserId: receiverId,
      status: "pending",
    });
  }

  async findRequestById(requestId) {
    return await FriendRequest.findById(requestId);
  }

  async createRequest(senderId, receiverId) {
    const request = new FriendRequest({
      fromUserId: senderId,
      toUserId: receiverId,
      status: "pending",
    });
    return await request.save();
  }

  async updateRequestStatus(requestId, status, session = null) {
    const opts = { new: true, ...(session ? { session } : {}) };
    return await FriendRequest.findByIdAndUpdate(
      requestId,
      { $set: { status, respondedAt: new Date() } },
      opts
    );
  }

  // Tìm request đang pending giữa 2 user (bất kể chiều nào)
  async findPendingRequestByPair(userId1, userId2) {
    return await FriendRequest.findOne({
      $or: [
        { fromUserId: userId1, toUserId: userId2 },
        { fromUserId: userId2, toUserId: userId1 },
      ],
      status: "pending",
    });
  }

  async cancelAllPendingByPair(userId1, userId2, session = null) {
    const opts = session ? { session } : {};
    return await FriendRequest.updateMany(
      {
        status: "pending",
        $or: [
          { fromUserId: userId1, toUserId: userId2 },
          { fromUserId: userId2, toUserId: userId1 },
        ],
      },
      { $set: { status: "canceled", respondedAt: new Date() } },
      opts
    );
  }

  async deleteRequest(senderId, receiverId) {
    return await FriendRequest.findOneAndDelete({
      fromUserId: senderId,
      toUserId: receiverId,
      status: "pending",
    });
  }

  async findIncomingRequests(userId, options = {}) {
    const { skip = 0, limit = 20 } = options;
    return await FriendRequest.find({ toUserId: userId, status: "pending" })
      .populate("fromUserId", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countIncomingRequests(userId) {
    return await FriendRequest.countDocuments({ toUserId: userId, status: "pending" });
  }

  async findOutgoingRequests(userId, options = {}) {
    const { skip = 0, limit = 20 } = options;
    return await FriendRequest.find({ fromUserId: userId, status: "pending" })
      .populate("toUserId", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countOutgoingRequests(userId) {
    return await FriendRequest.countDocuments({ fromUserId: userId, status: "pending" });
  }

  // ==================== FRIENDSHIP ====================

  async findFriendship(userId1, userId2) {
    return await Friendship.findOne(buildPair(userId1, userId2)).select("_id");
  }

  async createFriendship(userId1, userId2, session = null) {
    const pair = buildPair(userId1, userId2);
    const opts = session ? [{ ...pair }, { session }] : [{ ...pair }];
    const docs = await Friendship.create(opts);
    // Friendship.create trả mảng nếu truyền array, object nếu truyền object
    return Array.isArray(docs) ? docs[0] : docs;
  }

  async deleteFriendship(userId1, userId2, session = null) {
    const pair = buildPair(userId1, userId2);
    const opts = session ? { session } : {};
    return await Friendship.findOneAndDelete(pair, opts);
  }

  async findFriends(userId, options = {}) {
    const { skip = 0, limit = 20 } = options;
    return await Friendship.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate("userA", "username fullName avatar friendsCount")
      .populate("userB", "username fullName avatar friendsCount")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countFriends(userId) {
    return await Friendship.countDocuments({
      $or: [{ userA: userId }, { userB: userId }],
    });
  }

  // Resolve trạng thái friendship giữa 2 user — dùng trong userService và friendService
  async resolveFriendshipStatus(userId1, userId2) {
    const pair = buildPair(userId1, userId2);

    const [friendship, outgoingRequest, incomingRequest] = await Promise.all([
      Friendship.findOne(pair).select("_id"),
      FriendRequest.findOne({
        fromUserId: userId1,
        toUserId: userId2,
        status: "pending",
      }).select("_id"),
      FriendRequest.findOne({
        fromUserId: userId2,
        toUserId: userId1,
        status: "pending",
      }).select("_id"),
    ]);

    if (friendship) {
      return { status: "friends", isFriend: true, hasOutgoingRequest: false, hasIncomingRequest: false };
    }
    if (outgoingRequest) {
      return { status: "outgoing_request", isFriend: false, hasOutgoingRequest: true, hasIncomingRequest: false };
    }
    if (incomingRequest) {
      return { status: "incoming_request", isFriend: false, hasOutgoingRequest: false, hasIncomingRequest: true };
    }
    return { status: "none", isFriend: false, hasOutgoingRequest: false, hasIncomingRequest: false };
  }
}

module.exports = new FriendDAO();
