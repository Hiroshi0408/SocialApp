// chatService.test.js

// 1. Mock cac dependency TRUOC KHI import service
jest.mock("../../dao/conversationDAO");
jest.mock("../../dao/messageDAO");
jest.mock("../../dao/userDAO");
jest.mock("../../dao/friendDAO");
jest.mock("../../utils/logger");
jest.mock("../../config/socket", () => ({
  getIO: jest.fn(),
}));

// 2. Import SAU KHI mock
const chatService = require("../../services/chatService");
const conversationDAO = require("../../dao/conversationDAO");
const messageDAO = require("../../dao/messageDAO");
const userDAO = require("../../dao/userDAO");
const friendDAO = require("../../dao/friendDAO");
const { getIO } = require("../../config/socket");

// -------------------------------------------------------------
// Helper
// -------------------------------------------------------------
const makeFakeMessage = (overrides = {}) => ({
  _id: "msg1",
  conversationId: "conv1",
  sender: "senderId",
  content: "hello",
  messageType: "text",
  createdAt: new Date("2026-01-01"),
  populate: jest.fn().mockResolvedValue(),
  toJSON: jest.fn().mockReturnValue({ _id: "msg1", content: "hello" }),
  ...overrides,
});

const makeSocketIO = () => {
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  return { to, emit };
};

beforeEach(() => {
  jest.clearAllMocks();
});

// =============================================================
// getConversations
// =============================================================
describe("getConversations", () => {
  test("tach friendConversations va pendingConversations dung", async () => {
    friendDAO.findFriendIds.mockResolvedValue(["friend1"]);
    conversationDAO.findByUser.mockResolvedValue([
      {
        _id: "convFriend",
        type: "direct",
        participants: [
          { _id: { toString: () => "currentUser" }, username: "me" },
          { _id: { toString: () => "friend1" }, username: "alice" },
        ],
        lastMessage: { content: "hi" },
        lastMessageAt: new Date("2026-01-02"),
        unreadCount: { currentUser: 2 },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
      {
        _id: "convPending",
        type: "direct",
        participants: [
          { _id: { toString: () => "currentUser" }, username: "me" },
          { _id: { toString: () => "stranger1" }, username: "stranger" },
        ],
        unreadCount: {},
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
      {
        _id: "convGroup",
        type: "group",
        participants: [
          { _id: { toString: () => "currentUser" }, username: "me" },
          { _id: { toString: () => "stranger2" }, username: "bob" },
        ],
        unreadCount: {},
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      },
    ]);

    const result = await chatService.getConversations("currentUser");

    expect(result.conversations).toHaveLength(3);
    expect(result.friendConversations).toHaveLength(2);
    expect(result.pendingConversations).toHaveLength(1);
    expect(result.conversations[0].unreadCount).toBe(2);
    expect(result.conversations[1].unreadCount).toBe(0);
  });
});

// =============================================================
// getOrCreateConversation
// =============================================================
describe("getOrCreateConversation", () => {
  test("throw 404 neu target user khong ton tai", async () => {
    userDAO.findById.mockResolvedValue(null);

    await expect(
      chatService.getOrCreateConversation("currentUser", "ghost"),
    ).rejects.toMatchObject({ statusCode: 404, message: "User not found" });
  });

  test("tra ve conversation co san neu da ton tai", async () => {
    const existing = { _id: "conv1" };

    userDAO.findById.mockResolvedValue({ _id: "targetUser" });
    conversationDAO.findBetweenUsers.mockResolvedValue(existing);

    const result = await chatService.getOrCreateConversation(
      "currentUser",
      "targetUser",
    );

    expect(result).toBe(existing);
    expect(conversationDAO.create).not.toHaveBeenCalled();
  });

  test("tao conversation moi neu chua ton tai", async () => {
    const populated = { _id: "convNew", participants: [] };

    userDAO.findById.mockResolvedValue({ _id: "targetUser" });
    conversationDAO.findBetweenUsers.mockResolvedValue(null);
    conversationDAO.create.mockResolvedValue({ _id: "convNew" });
    conversationDAO.findWithPopulatedById.mockResolvedValue(populated);

    const result = await chatService.getOrCreateConversation(
      "currentUser",
      "targetUser",
    );

    expect(conversationDAO.create).toHaveBeenCalledWith({
      participants: ["currentUser", "targetUser"],
    });
    expect(conversationDAO.findWithPopulatedById).toHaveBeenCalledWith(
      "convNew",
    );
    expect(result).toBe(populated);
  });
});

// =============================================================
// getMessages
// =============================================================
describe("getMessages", () => {
  test("throw 404 neu conversation khong ton tai", async () => {
    conversationDAO.findById.mockResolvedValue(null);

    await expect(
      chatService.getMessages("conv1", "currentUser", { page: 1, limit: 10 }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Conversation not found",
    });
  });

  test("tra ve messages oldest-first va pagination dung", async () => {
    conversationDAO.findById.mockResolvedValue({ _id: "conv1" });
    messageDAO.findByConversation.mockResolvedValue([
      { _id: "newest", createdAt: new Date("2026-01-02") },
      { _id: "older", createdAt: new Date("2026-01-01") },
    ]);
    messageDAO.count.mockResolvedValue(12);

    const result = await chatService.getMessages("conv1", "currentUser", {
      page: 1,
      limit: 10,
    });

    expect(messageDAO.findByConversation).toHaveBeenCalledWith("conv1", {
      skip: 0,
      limit: 10,
    });
    expect(result.messages[0]._id).toBe("older");
    expect(result.messages[1]._id).toBe("newest");
    expect(result.pagination.total).toBe(12);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.pagination.hasMore).toBe(true);
  });
});

// =============================================================
// sendMessage
// =============================================================
describe("sendMessage", () => {
  test("throw 400 neu text message khong co content", async () => {
    await expect(
      chatService.sendMessage("conv1", "senderId", {
        messageType: "text",
        content: "  ",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Message content is required",
    });
  });

  test("throw 400 neu image message khong co mediaUrl", async () => {
    await expect(
      chatService.sendMessage("conv1", "senderId", {
        messageType: "image",
        content: "ignored",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Image URL is required for image messages",
    });
  });

  test("throw 404 neu conversation khong ton tai", async () => {
    conversationDAO.findById.mockResolvedValue(null);

    await expect(
      chatService.sendMessage("conv1", "senderId", { content: "hello" }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Conversation not found",
    });
  });

  test("gui message thanh cong + update unread + emit socket", async () => {
    const io = makeSocketIO();
    const message = makeFakeMessage({
      _id: "msg1",
      createdAt: new Date("2026-01-03"),
      toJSON: jest.fn().mockReturnValue({ _id: "msg1", content: "hello" }),
    });

    getIO.mockReturnValue(io);
    conversationDAO.findById.mockResolvedValue({
      _id: "conv1",
      participants: ["senderId", "receiverId"],
    });
    messageDAO.create.mockResolvedValue(message);
    conversationDAO.updateLastMessage.mockResolvedValue({});
    conversationDAO.incrementUnread.mockResolvedValue({});

    const result = await chatService.sendMessage("conv1", "senderId", {
      content: "  hello  ",
      isEncrypted: true,
    });

    expect(messageDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv1",
        sender: "senderId",
        content: "hello",
        messageType: "text",
        mediaUrl: "",
        isEncrypted: true,
      }),
    );
    expect(message.populate).toHaveBeenCalledWith(
      "sender",
      "username avatar fullName",
    );
    expect(conversationDAO.updateLastMessage).toHaveBeenCalledWith(
      "conv1",
      "msg1",
      message.createdAt,
    );
    expect(conversationDAO.incrementUnread).toHaveBeenCalledWith(
      "conv1",
      "receiverId",
    );

    expect(io.to).toHaveBeenCalledWith("user:receiverId");
    expect(io.emit).toHaveBeenCalledWith("message:new", {
      message: { _id: "msg1", content: "hello" },
      conversationId: "conv1",
    });
    expect(result).toBe(message);
  });

  test("socket loi khong block response", async () => {
    const message = makeFakeMessage();

    getIO.mockImplementation(() => {
      throw new Error("socket down");
    });
    conversationDAO.findById.mockResolvedValue({
      _id: "conv1",
      participants: ["senderId", "receiverId"],
    });
    messageDAO.create.mockResolvedValue(message);
    conversationDAO.updateLastMessage.mockResolvedValue({});
    conversationDAO.incrementUnread.mockResolvedValue({});

    const result = await chatService.sendMessage("conv1", "senderId", {
      content: "hello",
    });

    expect(result).toBe(message);
  });
});

// =============================================================
// markAsRead
// =============================================================
describe("markAsRead", () => {
  test("throw 404 neu conversation khong ton tai", async () => {
    conversationDAO.findById.mockResolvedValue(null);

    await expect(
      chatService.markAsRead("conv1", "currentUser"),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Conversation not found",
    });
  });

  test("mark read thanh cong + emit socket", async () => {
    const io = makeSocketIO();

    getIO.mockReturnValue(io);
    conversationDAO.findById.mockResolvedValue({
      _id: "conv1",
      participants: ["currentUser", "otherUser"],
    });
    messageDAO.markAsRead.mockResolvedValue({});
    conversationDAO.resetUnread.mockResolvedValue({});

    await expect(
      chatService.markAsRead("conv1", "currentUser"),
    ).resolves.toBeUndefined();

    expect(messageDAO.markAsRead).toHaveBeenCalledWith("conv1", "currentUser");
    expect(conversationDAO.resetUnread).toHaveBeenCalledWith(
      "conv1",
      "currentUser",
    );
    expect(io.to).toHaveBeenCalledWith("user:otherUser");
    expect(io.emit).toHaveBeenCalledWith("messages:read", {
      conversationId: "conv1",
      readBy: "currentUser",
    });
  });

  test("socket loi khi mark read khong block", async () => {
    getIO.mockImplementation(() => {
      throw new Error("socket down");
    });
    conversationDAO.findById.mockResolvedValue({
      _id: "conv1",
      participants: ["currentUser", "otherUser"],
    });
    messageDAO.markAsRead.mockResolvedValue({});
    conversationDAO.resetUnread.mockResolvedValue({});

    await expect(
      chatService.markAsRead("conv1", "currentUser"),
    ).resolves.toBeUndefined();
  });
});
