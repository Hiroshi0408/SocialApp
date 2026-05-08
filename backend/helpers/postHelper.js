const { getTimeAgo } = require("../utils/timeHelper");

// Synth media[] từ legacy image/video cho post cũ chưa có field này.
// FE chỉ đọc media[] → BE phải đảm bảo response luôn có ít nhất [] hợp lệ.
function _synthesizeMedia(post) {
  if (Array.isArray(post.media) && post.media.length > 0) return post.media;
  if (post.video) {
    return [{ type: "video", url: post.video, duration: post.videoDuration || 0 }];
  }
  if (post.image) {
    return [{ type: "image", url: post.image, duration: 0 }];
  }
  return [];
}

const formatPostsWithMetadata = (posts, likedPostIds, savedPostIds) => {
  return posts.map((post) => ({
    ...post,
    media: _synthesizeMedia(post),
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
