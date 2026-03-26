const { getTimeAgo } = require("../utils/timeHelper");

const formatPostsWithMetadata = (posts, likedPostIds, savedPostIds) => {
  return posts.map((post) => ({
    ...post,
    user: post.userId,
    likes: typeof post.likesCount === "number" ? post.likesCount : 0,
    comments: typeof post.commentsCount === "number" ? post.commentsCount : 0,
    isLiked: likedPostIds.has(post._id.toString()),
    isSaved: savedPostIds.has(post._id.toString()),
    timestamp: getTimeAgo(post.createdAt),
    commentsList: [],
  }));
};

module.exports = { formatPostsWithMetadata };
