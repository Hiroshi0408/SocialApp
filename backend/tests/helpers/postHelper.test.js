// postHelper.test.js

jest.mock("../../utils/timeHelper", () => ({
  getTimeAgo: jest.fn(() => "1 hour ago"),
}));

const { getTimeAgo } = require("../../utils/timeHelper");
const { formatPostsWithMetadata } = require("../../helpers/postHelper");

describe("formatPostsWithMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("map posts thanh format metadata day du", () => {
    const posts = [
      {
        _id: { toString: () => "post1" },
        userId: { _id: "user1", username: "alice" },
        likesCount: 5,
        commentsCount: 2,
        createdAt: new Date("2026-01-01"),
      },
      {
        _id: { toString: () => "post2" },
        userId: { _id: "user2", username: "bob" },
        createdAt: new Date("2026-01-02"),
      },
    ];

    const likedPostIds = new Set(["post1"]);
    const savedPostIds = new Set(["post2"]);

    const result = formatPostsWithMetadata(posts, likedPostIds, savedPostIds);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual(
      expect.objectContaining({
        user: { _id: "user1", username: "alice" },
        likes: 5,
        comments: 2,
        isLiked: true,
        isSaved: false,
        timestamp: "1 hour ago",
        commentsList: [],
      }),
    );

    expect(result[1]).toEqual(
      expect.objectContaining({
        user: { _id: "user2", username: "bob" },
        likes: 0,
        comments: 0,
        isLiked: false,
        isSaved: true,
        timestamp: "1 hour ago",
        commentsList: [],
      }),
    );

    expect(getTimeAgo).toHaveBeenCalledTimes(2);
  });
});
