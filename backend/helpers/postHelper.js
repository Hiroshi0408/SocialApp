const formatPostsWithMetadata = (posts, likedPostIds, savedPostIds) => {
  return posts.map((post) => ({
    ...post,
    user: post.userId,
    isLiked: likedPostIds.has(post._id.toString()),
    isSaved: savedPostIds.has(post._id.toString()),
    timestamp: getTimeAgo(post.createdAt),
    commentsList: [],
  }));
};

module.exports = {
  formatPostsWithMetadata,
};
