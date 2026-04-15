// commentService.test.js

// 1. Mock cac dependency TRUOC KHI import service
jest.mock("../../dao/commentDAO");
jest.mock("../../dao/postDAO");
jest.mock("../../dao/likeDAO");
jest.mock("../../dao/notificationDAO");
jest.mock("../../services/notificationService");
jest.mock("../../utils/logger");
jest.mock("../../utils/timeHelper", () => ({
  getTimeAgo: jest.fn(() => "just now"),
}));
jest.mock("../../utils/mentionHelper", () => ({
  extractMentions: jest.fn(),
  validateMentions: jest.fn(),
}));
jest.mock("../../services/geminiModeration", () => ({
  moderateText: jest.fn(),
}));

// 2. Import SAU KHI mock
const commentService = require("../../services/commentService");
const commentDAO = require("../../dao/commentDAO");
const postDAO = require("../../dao/postDAO");
const likeDAO = require("../../dao/likeDAO");
const notificationDAO = require("../../dao/notificationDAO");
const notificationService = require("../../services/notificationService");
const {
  extractMentions,
  validateMentions,
} = require("../../utils/mentionHelper");
const { moderateText } = require("../../services/geminiModeration");

// -------------------------------------------------------------
// Helper
// -------------------------------------------------------------
const makeFakeComment = (overrides = {}) => ({
  _id: "comment1",
  postId: "post123",
  userId: { toString: () => "authorId" },
  parentCommentId: null,
  likesCount: 3,
  createdAt: new Date("2026-01-01"),
  populate: jest.fn().mockResolvedValue(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  moderateText.mockResolvedValue({
    allowed: true,
    verdict: "ok",
    reasons: [],
    categories: [],
  });
  extractMentions.mockReturnValue([]);
  validateMentions.mockResolvedValue([]);
  notificationService.createNotification.mockResolvedValue();
});

// =============================================================
// addComment
// =============================================================
describe("addComment", () => {
  test("throw 400 neu text rong", async () => {
    await expect(
      commentService.addComment("authorId", "post123", { text: "   " }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Comment text is required",
    });
  });

  test("throw 400 neu moderation chan noi dung", async () => {
    moderateText.mockResolvedValue({
      allowed: false,
      verdict: "block",
      reasons: ["toxicity"],
      categories: ["abuse"],
    });

    await expect(
      commentService.addComment("authorId", "post123", { text: "bad content" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Comment violates community guidelines",
    });
  });

  test("throw 404 neu post khong ton tai", async () => {
    postDAO.findById.mockResolvedValue(null);

    await expect(
      commentService.addComment("authorId", "post123", { text: "hello" }),
    ).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
  });

  test("throw 403 neu post tat comments", async () => {
    postDAO.findById.mockResolvedValue({
      _id: "post123",
      allowComments: false,
    });

    await expect(
      commentService.addComment("authorId", "post123", { text: "hello" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Comments are disabled for this post",
    });
  });

  test("throw 404 neu parent comment sai post", async () => {
    postDAO.findById.mockResolvedValue({
      _id: "post123",
      userId: "ownerId",
      allowComments: true,
    });
    commentDAO.findById.mockResolvedValue({
      _id: "parent1",
      postId: "anotherPost",
    });

    await expect(
      commentService.addComment("authorId", "post123", {
        text: "reply",
        parentCommentId: "parent1",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Parent comment not found or belongs to different post",
    });
  });

  test("throw 400 neu vuot qua depth toi da", async () => {
    postDAO.findById.mockResolvedValue({
      _id: "post123",
      userId: "ownerId",
      allowComments: true,
    });

    // Lan 1: tim parent comment theo parentCommentId input
    // Lan 2-3: di len chain parent de tinh depth
    commentDAO.findById
      .mockResolvedValueOnce({
        _id: "parent1",
        postId: "post123",
        parentCommentId: "root1",
      })
      .mockResolvedValueOnce({ _id: "root1", parentCommentId: "root0" })
      .mockResolvedValueOnce({ _id: "root0", parentCommentId: null });

    await expect(
      commentService.addComment("authorId", "post123", {
        text: "nested reply",
        parentCommentId: "parent1",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/Maximum comment nesting depth/),
    });
  });

  test("tao comment thanh cong -> tang commentsCount va tao notification", async () => {
    const fakeComment = makeFakeComment({
      _id: "commentNew",
      userId: "authorId",
    });

    postDAO.findById.mockResolvedValue({
      _id: "post123",
      userId: "ownerId",
      allowComments: true,
    });
    extractMentions.mockReturnValue(["alice", "owner"]);
    validateMentions.mockResolvedValue([
      { _id: "mentioned1" },
      { _id: "ownerId" },
      { _id: "authorId" },
    ]);
    commentDAO.create.mockResolvedValue(fakeComment);
    postDAO.incrementCommentsCount.mockResolvedValue();

    const result = await commentService.addComment("authorId", "post123", {
      text: "hello @alice",
    });

    expect(commentDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "authorId",
        postId: "post123",
        text: "hello @alice",
        mentions: ["alice", "owner"],
      }),
    );
    expect(postDAO.incrementCommentsCount).toHaveBeenCalledWith("post123");
    expect(fakeComment.populate).toHaveBeenCalledWith(
      "userId",
      "username fullName avatar",
    );

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "ownerId",
        type: "comment",
        targetType: "post",
      }),
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "mentioned1",
        type: "mention",
        targetType: "comment",
      }),
    );

    expect(result).toBe(fakeComment);
  });
});

// =============================================================
// getComments
// =============================================================
describe("getComments", () => {
  test("tra ve comments da format + pagination dung", async () => {
    commentDAO.findByPost.mockResolvedValue([
      {
        _id: "c1",
        userId: { _id: "u1", username: "alice" },
        createdAt: new Date("2026-01-01"),
      },
    ]);
    commentDAO.count.mockResolvedValue(1);

    const result = await commentService.getComments("post123", {
      page: 1,
      limit: 20,
    });

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].user).toEqual({ _id: "u1", username: "alice" });
    expect(result.comments[0].timestamp).toBe("just now");
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.hasMore).toBe(false);
  });
});

// =============================================================
// deleteComment
// =============================================================
describe("deleteComment", () => {
  test("throw 404 neu comment khong ton tai", async () => {
    commentDAO.findById.mockResolvedValue(null);

    await expect(
      commentService.deleteComment("comment1", "authorId"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Comment not found" });
  });

  test("throw 403 neu khong phai owner", async () => {
    commentDAO.findById.mockResolvedValue(
      makeFakeComment({ userId: { toString: () => "anotherUser" } }),
    );

    await expect(
      commentService.deleteComment("comment1", "authorId"),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You are not authorized to delete this comment",
    });
  });

  test("delete thanh cong -> xoa descendants, likes, notifications va giam counter", async () => {
    commentDAO.findById.mockResolvedValue(
      makeFakeComment({
        _id: "comment1",
        postId: "post123",
        userId: { toString: () => "authorId" },
        parentCommentId: "parentA",
      }),
    );
    commentDAO.findDescendants.mockResolvedValue([
      { _id: "child1" },
      { _id: "child2" },
    ]);
    commentDAO.softDeleteById.mockResolvedValue({});
    commentDAO.softDeleteMany.mockResolvedValue({});
    likeDAO.deleteManyByTarget.mockResolvedValue({});
    notificationDAO.deleteMany.mockResolvedValue({});
    postDAO.decrementCommentsCount.mockResolvedValue({});
    commentDAO.decrementRepliesCount.mockResolvedValue({});

    await expect(
      commentService.deleteComment("comment1", "authorId"),
    ).resolves.toBeUndefined();

    expect(likeDAO.deleteManyByTarget).toHaveBeenCalledWith(
      { $in: ["comment1", "child1", "child2"] },
      "comment",
    );
    expect(notificationDAO.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: "comment" }),
    );
    expect(postDAO.decrementCommentsCount).toHaveBeenCalledWith("post123", 3);
    expect(commentDAO.decrementRepliesCount).toHaveBeenCalledWith("parentA");
  });
});

// =============================================================
// toggleCommentLike
// =============================================================
describe("toggleCommentLike", () => {
  test("throw 404 neu comment khong ton tai", async () => {
    commentDAO.findById.mockResolvedValue(null);

    await expect(
      commentService.toggleCommentLike("comment1", "userId123"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Comment not found" });
  });

  test("unlike thanh cong", async () => {
    commentDAO.findById.mockResolvedValue(
      makeFakeComment({ _id: "comment1", likesCount: 5 }),
    );
    likeDAO.findOne.mockResolvedValue({ _id: "like1" });
    likeDAO.deleteById.mockResolvedValue({});
    commentDAO.decrementLikesCount.mockResolvedValue({});
    notificationDAO.deleteOne.mockResolvedValue({});

    const result = await commentService.toggleCommentLike(
      "comment1",
      "userId123",
    );

    expect(result).toEqual({ isLiked: false, likesCount: 4 });
    expect(commentDAO.decrementLikesCount).toHaveBeenCalledWith("comment1");
  });

  test("like duplicate key -> khong throw, tra ve state da like", async () => {
    commentDAO.findById.mockResolvedValue(
      makeFakeComment({ _id: "comment1", likesCount: 5 }),
    );
    likeDAO.findOne.mockResolvedValue(null);
    likeDAO.create.mockRejectedValue(
      Object.assign(new Error("Duplicate"), { code: 11000 }),
    );

    const result = await commentService.toggleCommentLike(
      "comment1",
      "userId123",
    );

    expect(result).toEqual({ isLiked: true, likesCount: 5 });
  });

  test("like thanh cong -> tang likesCount va fire notification", async () => {
    commentDAO.findById.mockResolvedValue(
      makeFakeComment({ _id: "comment1", likesCount: 2, userId: "ownerId" }),
    );
    likeDAO.findOne.mockResolvedValue(null);
    likeDAO.create.mockResolvedValue({ _id: "newLike" });
    commentDAO.incrementLikesCount.mockResolvedValue({});

    const result = await commentService.toggleCommentLike(
      "comment1",
      "userId123",
    );

    expect(commentDAO.incrementLikesCount).toHaveBeenCalledWith("comment1");
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "ownerId",
        senderId: "userId123",
        type: "like",
        targetType: "comment",
      }),
    );
    expect(result).toEqual({ isLiked: true, likesCount: 3 });
  });
});
