// postService.test.js

// 1. Mock cac dependency TRUOC KHI import service
jest.mock("../../dao/postDAO");
jest.mock("../../dao/likeDAO");
jest.mock("../../dao/saveDAO");
jest.mock("../../dao/userDAO");
jest.mock("../../dao/commentDAO");
jest.mock("../../dao/followDAO");
jest.mock("../../dao/friendDAO");
jest.mock("../../dao/notificationDAO");
jest.mock("../../services/notificationService");
jest.mock("../../utils/logger");
jest.mock("../../utils/timeHelper", () => ({
  getTimeAgo: jest.fn(() => "1h ago"),
}));
jest.mock("../../utils/mentionHelper", () => ({
  validateMentions: jest.fn(),
}));
jest.mock("../../helpers/postHelper", () => ({
  formatPostsWithMetadata: jest.fn(),
}));
jest.mock("../../services/geminiModeration", () => ({
  moderateText: jest.fn(),
}));

// 2. Import SAU KHI mock
const postService = require("../../services/postService");
const postDAO = require("../../dao/postDAO");
const likeDAO = require("../../dao/likeDAO");
const saveDAO = require("../../dao/saveDAO");
const userDAO = require("../../dao/userDAO");
const commentDAO = require("../../dao/commentDAO");
const followDAO = require("../../dao/followDAO");
const friendDAO = require("../../dao/friendDAO");
const notificationDAO = require("../../dao/notificationDAO");
const notificationService = require("../../services/notificationService");
const { validateMentions } = require("../../utils/mentionHelper");
const { formatPostsWithMetadata } = require("../../helpers/postHelper");
const { moderateText } = require("../../services/geminiModeration");

// -------------------------------------------------------------
// Helper
// -------------------------------------------------------------
const makeFakePost = (overrides = {}) => ({
  _id: "post1",
  userId: { toString: () => "ownerId" },
  likesCount: 3,
  commentsCount: 2,
  mentions: [],
  taggedUsers: [],
  createdAt: new Date("2026-01-01"),
  toJSON: jest.fn().mockReturnValue({ _id: "post1", caption: "hello" }),
  populate: jest.fn().mockResolvedValue(),
  save: jest.fn().mockResolvedValue(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();

  notificationService.createNotification.mockResolvedValue();
  moderateText.mockResolvedValue({
    allowed: true,
    verdict: "ok",
    reasons: [],
    categories: [],
  });
  validateMentions.mockResolvedValue([]);
  formatPostsWithMetadata.mockImplementation((posts) => posts);
});

// =============================================================
// getFeed
// =============================================================
describe("getFeed", () => {
  test("scope=friends -> dung friendDAO va include current user", async () => {
    friendDAO.findFriendIds.mockResolvedValue(["friendA", "friendB"]);
    postDAO.findMany.mockResolvedValue([{ _id: "p1" }]);
    postDAO.count.mockResolvedValue(1);
    likeDAO.findByUserAndTargets.mockResolvedValue([]);
    saveDAO.findByUserAndPosts.mockResolvedValue([]);

    const result = await postService.getFeed("currentUser", {
      scope: "friends",
      page: 1,
      limit: 10,
    });

    expect(friendDAO.findFriendIds).toHaveBeenCalledWith("currentUser");
    expect(followDAO.findFollowingIds).not.toHaveBeenCalled();
    expect(postDAO.findMany).toHaveBeenCalledWith(
      { userId: { $in: ["friendA", "friendB", "currentUser"] } },
      expect.objectContaining({ skip: 0, limit: 10, lean: true }),
    );
    expect(result.posts).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  test("scope mac dinh la following", async () => {
    followDAO.findFollowingIds.mockResolvedValue(["followedA"]);
    postDAO.findMany.mockResolvedValue([{ _id: "p1" }]);
    postDAO.count.mockResolvedValue(1);
    likeDAO.findByUserAndTargets.mockResolvedValue([]);
    saveDAO.findByUserAndPosts.mockResolvedValue([]);

    await postService.getFeed("currentUser", {});

    expect(followDAO.findFollowingIds).toHaveBeenCalledWith("currentUser");
    expect(friendDAO.findFriendIds).not.toHaveBeenCalled();
  });
});

// =============================================================
// getPostById
// =============================================================
describe("getPostById", () => {
  test("throw 404 neu post khong ton tai", async () => {
    postDAO.findById.mockResolvedValue(null);

    await expect(
      postService.getPostById("missingPost", "userId123"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
  });

  test("tra ve post detail da format", async () => {
    const fakePost = makeFakePost({
      _id: "post123",
      userId: { _id: "ownerId", username: "owner" },
      likesCount: 5,
      commentsCount: 7,
      toJSON: jest.fn().mockReturnValue({ _id: "post123", caption: "caption" }),
    });

    postDAO.findById.mockResolvedValue(fakePost);
    likeDAO.findOne.mockResolvedValue({ _id: "like1" });
    saveDAO.findOne.mockResolvedValue({ _id: "save1" });
    commentDAO.findByPost.mockResolvedValue([
      {
        _id: "c1",
        userId: { _id: "u1", username: "alice" },
        createdAt: new Date("2026-01-01"),
      },
    ]);

    const result = await postService.getPostById("post123", "userId123");

    expect(result.isLiked).toBe(true);
    expect(result.isSaved).toBe(true);
    expect(result.likes).toBe(5);
    expect(result.comments).toBe(7);
    expect(result.timestamp).toBe("1h ago");
    expect(result.commentsList[0].timestamp).toBe("1h ago");
  });
});

// =============================================================
// createPost
// =============================================================
describe("createPost", () => {
  test("throw 400 neu khong co image/video", async () => {
    await expect(
      postService.createPost("userId123", { caption: "hello" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Image or video is required",
    });
  });

  test("throw 400 neu moderation chan caption", async () => {
    moderateText.mockResolvedValue({
      allowed: false,
      verdict: "block",
      reasons: ["hate"],
      categories: ["harmful"],
    });

    await expect(
      postService.createPost("userId123", { image: "img.jpg", caption: "bad" }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Caption violates community guidelines",
    });
  });

  test("tao post thanh cong -> tang postsCount + mention/tag notifications", async () => {
    const fakePost = makeFakePost({
      _id: "post123",
      mentions: ["alice", "me"],
      taggedUsers: ["tagged1", "authorId"],
      userId: "authorId",
    });

    postDAO.create.mockResolvedValue(fakePost);
    userDAO.incrementPostsCount.mockResolvedValue();
    validateMentions.mockResolvedValue([
      { _id: "mentioned1" },
      { _id: "authorId" },
    ]);

    const result = await postService.createPost("authorId", {
      image: "img.jpg",
      caption: "hello @alice",
      taggedUsers: ["tagged1", "authorId"],
    });

    expect(postDAO.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "authorId",
        image: "img.jpg",
        mediaType: "image",
        caption: "hello @alice",
      }),
    );
    expect(userDAO.incrementPostsCount).toHaveBeenCalledWith("authorId");
    expect(fakePost.populate).toHaveBeenCalledWith({
      path: "userId",
      select: "username fullName avatar",
    });

    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "mentioned1",
        targetType: "post",
        type: "mention",
      }),
    );
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "tagged1",
        targetType: "post",
        type: "mention",
      }),
    );
    expect(result).toBe(fakePost);
  });
});

// =============================================================
// updatePost / deletePost
// =============================================================
describe("updatePost", () => {
  test("throw 403 neu khong phai owner", async () => {
    postDAO.findById.mockResolvedValue(
      makeFakePost({ userId: { toString: () => "ownerId" } }),
    );

    await expect(
      postService.updatePost("post123", "otherUser", { caption: "new" }),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "You are not authorized to update this post",
    });
  });
});

describe("deletePost", () => {
  test("delete thanh cong -> soft delete + cleanup references", async () => {
    postDAO.findById.mockResolvedValue(
      makeFakePost({
        _id: "post123",
        userId: { toString: () => "ownerId" },
      }),
    );

    postDAO.softDeleteById.mockResolvedValue({});
    commentDAO.softDeleteMany.mockResolvedValue({});
    likeDAO.deleteManyByTarget.mockResolvedValue({});
    saveDAO.deleteByPostId.mockResolvedValue({});
    notificationDAO.deleteMany.mockResolvedValue({});
    userDAO.decrementPostsCount.mockResolvedValue({});

    await expect(
      postService.deletePost("post123", "ownerId"),
    ).resolves.toBeUndefined();

    expect(postDAO.softDeleteById).toHaveBeenCalledWith("post123");
    expect(commentDAO.softDeleteMany).toHaveBeenCalledWith({
      postId: "post123",
      deleted: false,
    });
    expect(likeDAO.deleteManyByTarget).toHaveBeenCalledWith("post123", "post");
    expect(saveDAO.deleteByPostId).toHaveBeenCalledWith("post123");
    expect(notificationDAO.deleteMany).toHaveBeenCalledWith({
      targetId: "post123",
      targetType: "post",
    });
    expect(userDAO.decrementPostsCount).toHaveBeenCalledWith("ownerId");
  });
});

// =============================================================
// toggleLike
// =============================================================
describe("toggleLike", () => {
  test("throw 404 neu post khong ton tai", async () => {
    postDAO.findById.mockResolvedValue(null);

    await expect(
      postService.toggleLike("post123", "userId123"),
    ).rejects.toMatchObject({ statusCode: 404, message: "Post not found" });
  });

  test("unlike thanh cong", async () => {
    postDAO.findById.mockResolvedValue(
      makeFakePost({ _id: "post123", likesCount: 5 }),
    );
    likeDAO.findOne.mockResolvedValue({ _id: "like1" });
    likeDAO.deleteById.mockResolvedValue({});
    postDAO.decrementLikesCount.mockResolvedValue({});
    notificationDAO.deleteOne.mockResolvedValue({});

    const result = await postService.toggleLike("post123", "userId123");

    expect(result).toEqual({ isLiked: false, likesCount: 4 });
    expect(postDAO.decrementLikesCount).toHaveBeenCalledWith("post123");
  });

  test("duplicate key khi like -> khong throw", async () => {
    postDAO.findById.mockResolvedValue(
      makeFakePost({ _id: "post123", likesCount: 5 }),
    );
    likeDAO.findOne.mockResolvedValue(null);
    likeDAO.create.mockRejectedValue(
      Object.assign(new Error("Duplicate"), { code: 11000 }),
    );

    const result = await postService.toggleLike("post123", "userId123");

    expect(result).toEqual({ isLiked: true, likesCount: 5 });
  });

  test("like thanh cong -> tang likesCount + fire notification", async () => {
    postDAO.findById.mockResolvedValue(
      makeFakePost({ _id: "post123", likesCount: 2, userId: "ownerId" }),
    );
    likeDAO.findOne.mockResolvedValue(null);
    likeDAO.create.mockResolvedValue({ _id: "newLike" });
    postDAO.incrementLikesCount.mockResolvedValue({});

    const result = await postService.toggleLike("post123", "userId123");

    expect(postDAO.incrementLikesCount).toHaveBeenCalledWith("post123");
    expect(notificationService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "ownerId",
        senderId: "userId123",
        targetType: "post",
        type: "like",
      }),
    );
    expect(result).toEqual({ isLiked: true, likesCount: 3 });
  });
});

// =============================================================
// searchByHashtag
// =============================================================
describe("searchByHashtag", () => {
  test("throw 400 neu query rong", async () => {
    await expect(
      postService.searchByHashtag("userId123", { q: "   " }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Search query is required",
    });
  });

  test("tu dong them # va lowercase", async () => {
    postDAO.findMany.mockResolvedValue([{ _id: "p1" }]);
    postDAO.count.mockResolvedValue(1);
    likeDAO.findByUserAndTargets.mockResolvedValue([]);
    saveDAO.findByUserAndPosts.mockResolvedValue([]);

    const result = await postService.searchByHashtag("userId123", {
      q: "ReactJS",
      page: 1,
      limit: 10,
    });

    expect(postDAO.findMany).toHaveBeenCalledWith(
      { hashtags: "#reactjs" },
      expect.any(Object),
    );
    expect(result.hashtag).toBe("#reactjs");
    expect(result.pagination.total).toBe(1);
  });
});
