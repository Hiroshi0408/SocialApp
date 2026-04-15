// userService.test.js

// 1. Mock các dependency TRƯỚC KHI import service
jest.mock("../../dao/userDAO");
jest.mock("../../dao/followDAO");
jest.mock("../../services/friendService");
jest.mock("../../dao/friendDAO");

// 2. Import SAU KHI mock
const userService = require("../../services/userService");
const userDAO = require("../../dao/userDAO");
const followDAO = require("../../dao/followDAO");
const friendService = require("../../services/friendService");

describe("getUserProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- CASE 1 ---
  test("throw 404 nếu user không tồn tại", async () => {
    userDAO.findOne.mockResolvedValue(null);
    await expect(
      userService.getUserProfile("ghost", "userId123"),
    ).rejects.toThrow("User not found");
  });

  // --- CASE 2 ---
  test("trả về profile đúng khi user tồn tại", async () => {
    const fakeUser = {
      _id: { toString: () => "userId456" },
      username: "an",
      toJSON: () => ({ _id: "userId456", username: "an" }),
    };

    userDAO.findOne.mockResolvedValue(fakeUser);
    followDAO.findOne.mockResolvedValue(null);
    friendService.resolveFriendshipStatus.mockResolvedValue("none");

    const result = await userService.getUserProfile("an", "userId123");

    expect(result).toEqual({
      user: {
        _id: "userId456",
        username: "an",
        isFollowing: false,
        friendship: "none",
        isOwnProfile: false,
      },
    });
  });
});
