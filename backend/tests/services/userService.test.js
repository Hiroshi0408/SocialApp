// userService.test.js

// 1. Mock các dependency TRƯỚC KHI import service
jest.mock("../../dao/userDAO");
jest.mock("../../dao/followDAO");
jest.mock("../../services/friendService");
jest.mock("../../dao/friendDAO");
jest.mock("../../services/notificationService");
jest.mock("../../services/postService");

// 2. Import SAU KHI mock
const userService = require("../../services/userService");
const userDAO = require("../../dao/userDAO");
const followDAO = require("../../dao/followDAO");
const friendService = require("../../services/friendService");
const notificationService = require("../../services/notificationService");

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
const makeFakeUser = (overrides = {}) => ({
  _id: { toString: () => "userId456" },
  username: "an",
  email: "an@example.com",
  toJSON: jest.fn().mockReturnValue({ _id: "userId456", username: "an" }),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================
// getUserProfile
// =============================================================
describe("getUserProfile", () => {
  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.findOne.mockResolvedValue(null);

    await expect(
      userService.getUserProfile("ghost", "userId123"),
    ).rejects.toMatchObject({ statusCode: 404, message: "User not found" });
  });

  test("trả về profile với isFollowing=false khi chưa follow", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findOne.mockResolvedValue(fakeUser);
    followDAO.findOne.mockResolvedValue(null);
    friendService.resolveFriendshipStatus.mockResolvedValue("none");

    const result = await userService.getUserProfile("an", "userId123");

    expect(result.user.isFollowing).toBe(false);
    expect(result.user.friendship).toBe("none");
    expect(result.user.isOwnProfile).toBe(false);
  });

  test("trả về isFollowing=true khi đã follow", async () => {
    const fakeUser = makeFakeUser();
    userDAO.findOne.mockResolvedValue(fakeUser);
    followDAO.findOne.mockResolvedValue({ _id: "followDoc" }); // có follow document
    friendService.resolveFriendshipStatus.mockResolvedValue("none");

    const result = await userService.getUserProfile("an", "userId123");

    expect(result.user.isFollowing).toBe(true);
  });

  test("isOwnProfile=true khi xem profile của chính mình", async () => {
    const fakeUser = makeFakeUser({ _id: { toString: () => "userId123" } });
    userDAO.findOne.mockResolvedValue(fakeUser);
    followDAO.findOne.mockResolvedValue(null);
    friendService.resolveFriendshipStatus.mockResolvedValue("none");

    const result = await userService.getUserProfile("an", "userId123");

    expect(result.user.isOwnProfile).toBe(true);
  });
});

// =============================================================
// updateProfile
// =============================================================
describe("updateProfile", () => {
  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.updateById.mockResolvedValue(null);

    await expect(
      userService.updateProfile("userId123", { fullName: "Nhan" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("throw 400 nếu Mongoose ValidationError", async () => {
    const validationError = Object.assign(new Error("Validation failed"), {
      name: "ValidationError",
      errors: { bio: { message: "Bio too long" } },
    });
    userDAO.updateById.mockRejectedValue(validationError);

    await expect(
      userService.updateProfile("userId123", { bio: "x".repeat(1000) }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("cập nhật thành công và trả về user mới", async () => {
    const fakeUser = makeFakeUser({ fullName: "Nhan Updated" });
    userDAO.updateById.mockResolvedValue(fakeUser);

    const result = await userService.updateProfile("userId123", {
      fullName: "Nhan Updated",
    });

    expect(result.message).toMatch(/successfully/i);
    expect(fakeUser.toJSON).toHaveBeenCalled();
  });

  test("chỉ update các field được truyền vào (không ghi đè undefined)", async () => {
    const fakeUser = makeFakeUser();
    userDAO.updateById.mockResolvedValue(fakeUser);

    await userService.updateProfile("userId123", { bio: "Hello" });

    // Chỉ bio được pass, fullName và website không có trong updates
    const callArgs = userDAO.updateById.mock.calls[0][1];
    expect(callArgs).toEqual({ bio: "Hello" });
    expect(callArgs).not.toHaveProperty("fullName");
    expect(callArgs).not.toHaveProperty("website");
  });
});

// =============================================================
// followUser
// =============================================================
describe("followUser", () => {
  test("throw 400 nếu follow chính mình", async () => {
    await expect(
      userService.followUser("userId123", "userId123"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Cannot follow yourself",
    });
  });

  test("throw 404 nếu target user không tồn tại", async () => {
    userDAO.findById.mockResolvedValue(null);

    await expect(
      userService.followUser("userId123", "userId456"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("throw 400 nếu đã follow rồi", async () => {
    userDAO.findById.mockResolvedValue(makeFakeUser());
    followDAO.findOne.mockResolvedValue({ _id: "existingFollow" });

    await expect(
      userService.followUser("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Already following this user",
    });
  });

  test("throw 400 nếu race condition (duplicate key error)", async () => {
    userDAO.findById.mockResolvedValue(makeFakeUser());
    followDAO.findOne.mockResolvedValue(null);
    followDAO.create.mockRejectedValue(
      Object.assign(new Error("Duplicate"), { code: 11000 }),
    );

    await expect(
      userService.followUser("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Already following this user",
    });
  });

  test("follow thành công → gọi incrementFollowCounters", async () => {
    userDAO.findById.mockResolvedValue(makeFakeUser());
    followDAO.findOne.mockResolvedValue(null);
    followDAO.create.mockResolvedValue({});
    userDAO.incrementFollowCounters.mockResolvedValue();
    notificationService.createNotification.mockResolvedValue();

    const result = await userService.followUser("userId123", "userId456");

    expect(userDAO.incrementFollowCounters).toHaveBeenCalledWith(
      "userId123",
      "userId456",
    );
    expect(result.message).toMatch(/followed/i);
  });

  test("notification fail không block response", async () => {
    userDAO.findById.mockResolvedValue(makeFakeUser());
    followDAO.findOne.mockResolvedValue(null);
    followDAO.create.mockResolvedValue({});
    userDAO.incrementFollowCounters.mockResolvedValue();
    notificationService.createNotification.mockRejectedValue(
      new Error("Notification service down"),
    );

    // Không throw, vẫn trả về kết quả bình thường
    const result = await userService.followUser("userId123", "userId456");
    expect(result.message).toMatch(/followed/i);
  });
});

// =============================================================
// unfollowUser
// =============================================================
describe("unfollowUser", () => {
  test("throw 404 nếu chưa follow", async () => {
    followDAO.deleteOne.mockResolvedValue(null);

    await expect(
      userService.unfollowUser("userId123", "userId456"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Not following this user",
    });
  });

  test("unfollow thành công → gọi decrementFollowCounters", async () => {
    followDAO.deleteOne.mockResolvedValue({ _id: "followDoc" });
    userDAO.decrementFollowCounters.mockResolvedValue();

    const result = await userService.unfollowUser("userId123", "userId456");

    expect(userDAO.decrementFollowCounters).toHaveBeenCalledWith(
      "userId123",
      "userId456",
    );
    expect(result.message).toMatch(/unfollowed/i);
  });
});

// =============================================================
// checkFollowStatus
// =============================================================
describe("checkFollowStatus", () => {
  test("trả về isFollowing=false khi chưa follow", async () => {
    followDAO.findOne.mockResolvedValue(null);

    const result = await userService.checkFollowStatus(
      "userId123",
      "userId456",
    );
    expect(result.isFollowing).toBe(false);
  });

  test("trả về isFollowing=true khi đã follow", async () => {
    followDAO.findOne.mockResolvedValue({ _id: "followDoc" });

    const result = await userService.checkFollowStatus(
      "userId123",
      "userId456",
    );
    expect(result.isFollowing).toBe(true);
  });
});

// =============================================================
// getFollowers / getFollowing
// =============================================================
describe("getFollowers", () => {
  test("trả về danh sách followers và pagination đúng", async () => {
    const fakeFollowers = [
      { follower: { _id: "a", username: "alice" } },
      { follower: { _id: "b", username: "bob" } },
    ];
    followDAO.findFollowers.mockResolvedValue(fakeFollowers);
    followDAO.countFollowers.mockResolvedValue(2);

    const result = await userService.getFollowers("userId123", {
      page: 1,
      limit: 10,
    });

    expect(result.users).toHaveLength(2);
    expect(result.pagination.total).toBe(2);
    expect(result.pagination.hasMore).toBe(false);
  });
});

describe("getFollowing", () => {
  test("trả về danh sách following và pagination đúng", async () => {
    const fakeFollowing = [{ following: { _id: "c", username: "charlie" } }];
    followDAO.findFollowing.mockResolvedValue(fakeFollowing);
    followDAO.countFollowing.mockResolvedValue(1);

    const result = await userService.getFollowing("userId123", {
      page: 1,
      limit: 10,
    });

    expect(result.users).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });
});

// =============================================================
// getSuggestedUsers
// =============================================================
describe("getSuggestedUsers", () => {
  test("loại trừ users đã follow và bản thân", async () => {
    followDAO.findFollowingIds.mockResolvedValue([
      "followedId1",
      "followedId2",
    ]);
    userDAO.findMany.mockResolvedValue([
      { _id: "suggestId1", username: "dave", followersCount: 100 },
    ]);

    const result = await userService.getSuggestedUsers("userId123");

    // Kiểm tra filter exclude đúng
    const filterArg = userDAO.findMany.mock.calls[0][0];
    expect(filterArg._id.$nin).toContain("followedId1");
    expect(filterArg._id.$nin).toContain("userId123");

    expect(result.users[0].isFollowing).toBe(false);
    expect(result.users[0].subtitle).toContain("followers");
  });

  test("format subtitle đúng với followersCount", async () => {
    followDAO.findFollowingIds.mockResolvedValue([]);
    userDAO.findMany.mockResolvedValue([
      { _id: "id1", username: "eve", followersCount: 42 },
    ]);

    const result = await userService.getSuggestedUsers("userId123");

    expect(result.users[0].subtitle).toBe("42 followers");
  });
});

// =============================================================
// searchUsers
// =============================================================
describe("searchUsers", () => {
  test("throw 400 nếu query rỗng", async () => {
    await expect(
      userService.searchUsers("", { page: 1, limit: 10 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Search query is required",
    });
  });

  test("throw 400 nếu query chỉ có khoảng trắng", async () => {
    await expect(
      userService.searchUsers("   ", { page: 1, limit: 10 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("trả về users và pagination đúng", async () => {
    userDAO.findMany.mockResolvedValue([
      { _id: "u1", username: "nhan", followersCount: 5 },
    ]);
    userDAO.count.mockResolvedValue(1);

    const result = await userService.searchUsers("nhan", {
      page: 1,
      limit: 10,
    });

    expect(result.users).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.hasMore).toBe(false);
  });

  test("hasMore=true khi còn trang tiếp theo", async () => {
    userDAO.findMany.mockResolvedValue(
      Array(10).fill({ _id: "uid", username: "user", followersCount: 0 }),
    );
    userDAO.count.mockResolvedValue(25);

    const result = await userService.searchUsers("user", {
      page: 1,
      limit: 10,
    });

    expect(result.pagination.hasMore).toBe(true);
  });
});
