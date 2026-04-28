// groupService.test.js

// 1. Mock cac dependency TRUOC KHI import service
jest.mock("../../dao/groupDAO");
jest.mock("../../utils/logger");

// 2. Import SAU KHI mock
const groupService = require("../../services/groupService");
const groupDAO = require("../../dao/groupDAO");

// -------------------------------------------------------------
// Helper
// -------------------------------------------------------------
const makeFakeGroup = (overrides = {}) => ({
  _id: "group1",
  name: "UIT MERN",
  description: "Group description",
  image: "group.jpg",
  members: [{ toString: () => "userA" }, { toString: () => "userB" }],
  membersCount: 2,
  creator: { _id: "creator1", username: "nhan" },
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================
// getJoinedGroups / getSuggestedGroups
// =============================================================
describe("getJoinedGroups", () => {
  test("tra ve danh sach da format", async () => {
    groupDAO.findMany.mockResolvedValue([
      makeFakeGroup({ _id: "g1", membersCount: 5 }),
      makeFakeGroup({ _id: "g2", membersCount: 2 }),
    ]);

    const result = await groupService.getJoinedGroups("userId123");

    expect(groupDAO.findMany).toHaveBeenCalledWith(
      { members: "userId123" },
      expect.objectContaining({ sort: { updatedAt: -1 } }),
    );
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({ id: "g1", members: 5 }),
    );
  });
});

describe("getSuggestedGroups", () => {
  test("default limit=10 va map ket qua dung", async () => {
    groupDAO.findMany.mockResolvedValue([makeFakeGroup({ _id: "g1" })]);

    const result = await groupService.getSuggestedGroups("userId123", {});

    expect(groupDAO.findMany).toHaveBeenCalledWith(
      { members: { $ne: "userId123" } },
      expect.objectContaining({ limit: 10, sort: { createdAt: -1 } }),
    );
    expect(result[0]).toEqual(expect.objectContaining({ id: "g1" }));
  });

  test("limit bi clamp toi da 50", async () => {
    groupDAO.findMany.mockResolvedValue([]);

    await groupService.getSuggestedGroups("userId123", { limit: 999 });

    expect(groupDAO.findMany).toHaveBeenCalledWith(
      { members: { $ne: "userId123" } },
      expect.objectContaining({ limit: 50 }),
    );
  });
});

// =============================================================
// createGroup
// =============================================================
describe("createGroup", () => {
  test("throw 400 neu name rong", async () => {
    await expect(
      groupService.createGroup("creatorId", { name: "   " }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Group name is required",
    });
  });

  test("tao group thanh cong va return formatGroup", async () => {
    const created = { _id: "groupNew" };
    const populated = makeFakeGroup({ _id: "groupNew", membersCount: 1 });

    groupDAO.create.mockResolvedValue(created);
    groupDAO.findWithCreator.mockResolvedValue(populated);

    const result = await groupService.createGroup("creatorId", {
      name: "  New Group  ",
      description: "  desc  ",
      image: "  image.jpg  ",
    });

    expect(groupDAO.create).toHaveBeenCalledWith({
      name: "New Group",
      description: "desc",
      image: "image.jpg",
      creator: "creatorId",
      members: ["creatorId"],
      membersCount: 1,
    });
    expect(groupDAO.findWithCreator).toHaveBeenCalledWith("groupNew");
    expect(result).toEqual(
      expect.objectContaining({
        id: "groupNew",
        members: 1,
        creator: populated.creator,
      }),
    );
  });
});

// =============================================================
// joinGroup
// =============================================================
describe("joinGroup", () => {
  test("throw 404 neu group khong ton tai", async () => {
    groupDAO.findById.mockResolvedValue(null);

    await expect(
      groupService.joinGroup("userId123", "group1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Group not found" });
  });

  test("neu da la member -> khong update, tra alreadyMember=true", async () => {
    groupDAO.findById.mockResolvedValue(
      makeFakeGroup({ members: [{ toString: () => "userId123" }] }),
    );
    groupDAO.findWithCreator.mockResolvedValue(
      makeFakeGroup({ _id: "group1" }),
    );

    const result = await groupService.joinGroup("userId123", "group1");

    expect(groupDAO.updateById).not.toHaveBeenCalled();
    expect(groupDAO.findWithCreator).toHaveBeenCalledWith("group1");
    expect(result.alreadyMember).toBe(true);
    expect(result.group.id).toBe("group1");
  });

  test("join thanh cong -> push member + inc counter", async () => {
    groupDAO.findById.mockResolvedValue(
      makeFakeGroup({ members: [{ toString: () => "anotherUser" }] }),
    );
    groupDAO.updateById.mockResolvedValue({});
    groupDAO.findWithCreator.mockResolvedValue(
      makeFakeGroup({ _id: "group1", membersCount: 2 }),
    );

    const result = await groupService.joinGroup("userId123", "group1");

    expect(groupDAO.updateById).toHaveBeenCalledWith("group1", {
      $push: { members: "userId123" },
      $inc: { membersCount: 1 },
    });
    expect(result.alreadyMember).toBe(false);
    expect(result.group.members).toBe(2);
  });
});

// =============================================================
// leaveGroup
// =============================================================
describe("leaveGroup", () => {
  test("throw 404 neu group khong ton tai", async () => {
    groupDAO.findById.mockResolvedValue(null);

    await expect(
      groupService.leaveGroup("userId123", "group1"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Group not found" });
  });

  test("neu roi nhom ma khong con ai -> xoa group", async () => {
    groupDAO.findById.mockResolvedValue(
      makeFakeGroup({ members: [{ toString: () => "userId123" }] }),
    );
    groupDAO.deleteById.mockResolvedValue({});

    const result = await groupService.leaveGroup("userId123", "group1");

    expect(groupDAO.deleteById).toHaveBeenCalledWith("group1");
    expect(groupDAO.updateById).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true });
  });

  test("neu con thanh vien -> pull member va update membersCount", async () => {
    groupDAO.findById.mockResolvedValue(
      makeFakeGroup({
        members: [
          { toString: () => "userId123" },
          { toString: () => "userB" },
          { toString: () => "userC" },
        ],
      }),
    );
    groupDAO.updateById.mockResolvedValue({});

    const result = await groupService.leaveGroup("userId123", "group1");

    expect(groupDAO.updateById).toHaveBeenCalledWith("group1", {
      $pull: { members: "userId123" },
      $set: { membersCount: 2 },
    });
    expect(result).toEqual({ deleted: false });
  });
});
