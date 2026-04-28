const mongoose = require("mongoose");
const friendDAO = require("../dao/friendDAO");
const userDAO = require("../dao/userDAO");
const notificationService = require("./notificationService");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { DEFAULT_USER_LIMIT, MAX_USER_LIMIT } = require("../constants");

class FriendService {
  async sendRequest(senderId, receiverId) {
    if (senderId.toString() === receiverId.toString()) {
      throw new AppError("Cannot send friend request to yourself", 400);
    }

    const targetUser = await userDAO.findOne(
      { _id: receiverId, deleted: false, status: "active" },
      { select: "_id" }
    );
    if (!targetUser) {
      throw new AppError("User not found", 404);
    }

    const existingFriendship = await friendDAO.findFriendship(senderId, receiverId);
    if (existingFriendship) {
      throw new AppError("You are already friends", 400);
    }

    const incomingRequest = await friendDAO.findRequest(receiverId, senderId);
    if (incomingRequest) {
      throw new AppError("This user already sent you a friend request", 400);
    }

    let request;
    try {
      request = await friendDAO.createRequest(senderId, receiverId);
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError("Friend request already sent", 400);
      }
      throw error;
    }

    // Notification fail không block response
    notificationService
      .createNotification({
        recipientId: receiverId,
        senderId,
        type: "friend_request",
        targetType: "user",
        targetId: senderId,
      })
      .catch((err) => logger.error("Friend request notification failed:", err.message));

    return request;
  }

  async cancelRequest(senderId, receiverId) {
    const deleted = await friendDAO.deleteRequest(senderId, receiverId);
    if (!deleted) {
      throw new AppError("No pending friend request to cancel", 404);
    }
  }

  async acceptRequest(requesterId, currentUserId) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const request = await friendDAO.findRequest(requesterId, currentUserId);
      if (!request) {
        await session.abortTransaction();
        throw new AppError("No pending friend request found", 404);
      }

      // Dùng session trong một số bước quan trọng
      const existingFriendship = await friendDAO.findFriendship(currentUserId, requesterId);
      if (!existingFriendship) {
        await friendDAO.createFriendship(currentUserId, requesterId, session);
        await Promise.all([
          userDAO.incrementFriendsCount(currentUserId, session),
          userDAO.incrementFriendsCount(requesterId, session),
        ]);
      }

      request.status = "accepted";
      request.respondedAt = new Date();
      await request.save({ session });

      await friendDAO.cancelAllPendingByPair(currentUserId, requesterId, session);

      await session.commitTransaction();

      // Notification ngoài transaction
      notificationService
        .createNotification({
          recipientId: requesterId,
          senderId: currentUserId,
          type: "friend_accept",
          targetType: "user",
          targetId: currentUserId,
        })
        .catch((err) => logger.error("Friend accept notification failed:", err.message));
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async rejectRequest(requesterId, currentUserId) {
    const request = await friendDAO.findRequest(requesterId, currentUserId);
    if (!request) {
      throw new AppError("No pending friend request found", 404);
    }

    request.status = "rejected";
    request.respondedAt = new Date();
    await request.save();
  }

  async unfriend(currentUserId, targetUserId) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const friendship = await friendDAO.deleteFriendship(currentUserId, targetUserId, session);
      if (!friendship) {
        await session.abortTransaction();
        throw new AppError("You are not friends with this user", 404);
      }

      await Promise.all([
        userDAO.decrementFriendsCount(currentUserId, session),
        userDAO.decrementFriendsCount(targetUserId, session),
      ]);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async getFriends(userId, query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(
      parseInt(query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT
    );
    const skip = (page - 1) * limit;

    const [friendships, total] = await Promise.all([
      friendDAO.findFriends(userId, { skip, limit }),
      friendDAO.countFriends(userId),
    ]);

    const friends = friendships
      .map((rel) =>
        rel.userA && rel.userA._id.toString() === userId.toString()
          ? rel.userB
          : rel.userA
      )
      .filter(Boolean);

    return {
      users: friends,
      pagination: { page, limit, total, hasMore: skip + friends.length < total },
    };
  }

  async getIncomingRequests(userId, query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(
      parseInt(query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT
    );
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      friendDAO.findIncomingRequests(userId, { skip, limit }),
      friendDAO.countIncomingRequests(userId),
    ]);

    const users = requests.map((r) => r.fromUserId).filter(Boolean);
    return {
      users,
      pagination: { page, limit, total, hasMore: skip + users.length < total },
    };
  }

  async getOutgoingRequests(userId, query = {}) {
    const page = parseInt(query.page, 10) || 1;
    const limit = Math.min(
      parseInt(query.limit, 10) || DEFAULT_USER_LIMIT,
      MAX_USER_LIMIT
    );
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      friendDAO.findOutgoingRequests(userId, { skip, limit }),
      friendDAO.countOutgoingRequests(userId),
    ]);

    const users = requests.map((r) => r.toUserId).filter(Boolean);
    return {
      users,
      pagination: { page, limit, total, hasMore: skip + users.length < total },
    };
  }

  async getFriendshipStatus(currentUserId, targetUserId) {
    if (currentUserId.toString() === targetUserId.toString()) {
      return { status: "self", isFriend: false, hasOutgoingRequest: false, hasIncomingRequest: false };
    }

    const targetUser = await userDAO.findById(targetUserId, { select: "_id" });
    if (!targetUser) {
      throw new AppError("User not found", 404);
    }

    return await friendDAO.resolveFriendshipStatus(currentUserId, targetUserId);
  }

  // Expose để userService dùng (không qua HTTP)
  resolveFriendshipStatus(userId1, userId2) {
    return friendDAO.resolveFriendshipStatus(userId1, userId2);
  }
}

module.exports = new FriendService();
