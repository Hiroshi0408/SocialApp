// friendService.test.js

// 1. Mock các dependency TRUOC KHI import service
jest.mock("../../dao/friendDAO");
jest.mock("../../dao/userDAO");
jest.mock("../../services/notificationService");
jest.mock("../../utils/logger");

// 2. Import SAU KHI mock
const mongoose = require("mongoose");
const friendService = require("../../services/friendService");
const friendDAO = require("../../dao/friendDAO");
const userDAO = require("../../dao/userDAO");
const notificationService = require("../../services/notificationService");

// -------------------------------------------------------------
// Helper
// -------------------------------------------------------------
const makeSession = () => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(),
  abortTransaction: jest.fn().mockResolvedValue(),
  endSession: jest.fn().mockResolvedValue(),
});

beforeEach(() => {
  jest.clearAllMocks();
  notificationService.createNotification.mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================
// sendRequest
// =============================================================
describe("sendRequest", () => {
  test("throw 400 neu gui loi moi ket ban cho chinh minh", async () => {
    await expect(
      friendService.sendRequest("userId123", "userId123"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot send friend request to yourself",
    });
  });

  test("throw 404 neu nguoi nhan khong ton tai", async () => {
    userDAO.findOne.mockResolvedValue(null);

    await expect(
      friendService.sendRequest("userId123", "userId456"),
    ).rejects.toMatchObject({ statusCode: 404, message: "User not found" });
  });

  test("throw 400 neu da la ban be", async () => {
    userDAO.findOne.mockResolvedValue({ _id: "userId456" });
    friendDAO.findFriendship.mockResolvedValue({ _id: "friendshipDoc" });

    await expect(
      friendService.sendRequest("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "You are already friends",
    });
  });

  test("throw 400 neu da co incoming request", async () => {
    userDAO.findOne.mockResolvedValue({ _id: "userId456" });
    friendDAO.findFriendship.mockResolvedValue(null);
    friendDAO.findRequest.mockResolvedValue({ _id: "incomingReq" });

    await expect(
      friendService.sendRequest("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "This user already sent you a friend request",
    });
  });

  test("throw 400 neu race condition duplicate key", async () => {
    userDAO.findOne.mockResolvedValue({ _id: "userId456" });
    friendDAO.findFriendship.mockResolvedValue(null);
    friendDAO.findRequest.mockResolvedValue(null);
    friendDAO.createRequest.mockRejectedValue(
      Object.assign(new Error("Duplicate"), { code: 11000 }),
    );

    await expect(
      friendService.sendRequest("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Friend request already sent",
    });
  });

  test("gui request thanh cong va fire notification", async () => {
    const requestDoc = { _id: "request1" };

    userDAO.findOne.mockResolvedValue({ _id: "userId456" });
    friendDAO.findFriendship.mockResolvedValue(null);
    friendDAO.findRequest.mockResolvedValue(null);
    friendDAO.createRequest.mockResolvedValue(requestDoc);

    const result = await friendService.sendRequest("userId123", "userId456");

    expect(result).toBe(requestDoc);
    expect(friendDAO.createRequest).toHaveBeenCalledWith(
      "userId123",
      "userId456",
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "userId456",
        senderId: "userId123",
        type: "friend_request",
      }),
    );
  });

  test("notification fail khong block response", async () => {
    const requestDoc = { _id: "request1" };

    userDAO.findOne.mockResolvedValue({ _id: "userId456" });
    friendDAO.findFriendship.mockResolvedValue(null);
    friendDAO.findRequest.mockResolvedValue(null);
    friendDAO.createRequest.mockResolvedValue(requestDoc);
    notificationService.createNotification.mockRejectedValue(
      new Error("notification down"),
    );

    const result = await friendService.sendRequest("userId123", "userId456");
    expect(result).toBe(requestDoc);
  });
});

// =============================================================
// cancelRequest
// =============================================================
describe("cancelRequest", () => {
  test("throw 404 neu khong co pending request", async () => {
    friendDAO.deleteRequest.mockResolvedValue(null);

    await expect(
      friendService.cancelRequest("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "No pending friend request to cancel",
    });
  });

  test("cancel thanh cong khi co pending request", async () => {
    friendDAO.deleteRequest.mockResolvedValue({ _id: "deletedReq" });

    await expect(
      friendService.cancelRequest("userId123", "userId456"),
    ).resolves.toBeUndefined();
  });
});

// =============================================================
// acceptRequest
// =============================================================
describe("acceptRequest", () => {
  test("throw 404 neu khong tim thay pending request", async () => {
    const session = makeSession();
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    friendDAO.findRequest.mockResolvedValue(null);

    await expect(
      friendService.acceptRequest("requesterId", "currentUserId"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "No pending friend request found",
    });

    expect(session.startTransaction).toHaveBeenCalled();
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test("accept thanh cong -> tao friendship, tang counters, commit", async () => {
    const session = makeSession();
    const requestDoc = {
      status: "pending",
      respondedAt: null,
      save: jest.fn().mockResolvedValue(),
    };

    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    friendDAO.findRequest.mockResolvedValue(requestDoc);
    friendDAO.findFriendship.mockResolvedValue(null);
    friendDAO.createFriendship.mockResolvedValue({ _id: "friendship1" });
    userDAO.incrementFriendsCount.mockResolvedValue();
    friendDAO.cancelAllPendingByPair.mockResolvedValue();

    await friendService.acceptRequest("requesterId", "currentUserId");

    expect(friendDAO.createFriendship).toHaveBeenCalledWith(
      "currentUserId",
      "requesterId",
      session,
    );
    expect(userDAO.incrementFriendsCount).toHaveBeenCalledWith(
      "currentUserId",
      session,
    );
    expect(userDAO.incrementFriendsCount).toHaveBeenCalledWith(
      "requesterId",
      session,
    );
    expect(requestDoc.status).toBe("accepted");
    expect(requestDoc.save).toHaveBeenCalledWith({ session });
    expect(friendDAO.cancelAllPendingByPair).toHaveBeenCalledWith(
      "currentUserId",
      "requesterId",
      session,
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });
});

// =============================================================
// unfriend
// =============================================================
describe("unfriend", () => {
  test("throw 404 neu 2 user khong phai ban be", async () => {
    const session = makeSession();
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    friendDAO.deleteFriendship.mockResolvedValue(null);

    await expect(
      friendService.unfriend("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "You are not friends with this user",
    });

    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test("unfriend thanh cong -> giam friendsCount 2 ben", async () => {
    const session = makeSession();
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    friendDAO.deleteFriendship.mockResolvedValue({ _id: "friendship1" });
    userDAO.decrementFriendsCount.mockResolvedValue();

    await friendService.unfriend("userId123", "userId456");

    expect(userDAO.decrementFriendsCount).toHaveBeenCalledWith(
      "userId123",
      session,
    );
    expect(userDAO.decrementFriendsCount).toHaveBeenCalledWith(
      "userId456",
      session,
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });
});

// =============================================================
// getFriends / getFriendshipStatus
// =============================================================
describe("getFriends", () => {
  test("map dung user con lai trong moi friendship", async () => {
    friendDAO.findFriends.mockResolvedValue([
      {
        userA: { _id: { toString: () => "current" }, username: "me" },
        userB: { _id: "friend1", username: "alice" },
      },
      {
        userA: { _id: "friend2", username: "bob" },
        userB: { _id: { toString: () => "current" }, username: "me" },
      },
    ]);
    friendDAO.countFriends.mockResolvedValue(2);

    const result = await friendService.getFriends("current", {
      page: 1,
      limit: 20,
    });

    expect(result.users).toHaveLength(2);
    expect(result.users[0].username).toBe("alice");
    expect(result.users[1].username).toBe("bob");
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.hasMore).toBe(false);
  });
});

describe("getFriendshipStatus", () => {
  test("tra ve self neu check chinh minh", async () => {
    const result = await friendService.getFriendshipStatus(
      "userId123",
      "userId123",
    );

    expect(result).toEqual({
      status: "self",
      isFriend: false,
      hasOutgoingRequest: false,
      hasIncomingRequest: false,
    });
  });

  test("throw 404 neu target user khong ton tai", async () => {
    userDAO.findById.mockResolvedValue(null);

    await expect(
      friendService.getFriendshipStatus("userId123", "ghost"),
    ).rejects.toMatchObject({ statusCode: 404, message: "User not found" });
  });

  test("tra ve status tu friendDAO khi target ton tai", async () => {
    const statusPayload = {
      status: "friends",
      isFriend: true,
      hasOutgoingRequest: false,
      hasIncomingRequest: false,
    };

    userDAO.findById.mockResolvedValue({ _id: "target" });
    friendDAO.resolveFriendshipStatus.mockResolvedValue(statusPayload);

    const result = await friendService.getFriendshipStatus(
      "userId123",
      "target",
    );

    expect(friendDAO.resolveFriendshipStatus).toHaveBeenCalledWith(
      "userId123",
      "target",
    );
    expect(result).toEqual(statusPayload);
  });
});
