import { DEFAULT_IMAGES } from "../constants";

export const getId = (item) => {
  return item?._id || item?.id || null;
};

export const getUserFullName = (user) => {
  return user?.fullName || user?.name || "";
};

export const getUserAvatar = (user) => {
  if (!user) return DEFAULT_IMAGES.AVATAR;
  return user.avatar || DEFAULT_IMAGES.AVATAR;
};

export const getAvatar = (item) => {
  return item?.user?.avatar || item?.avatar || "";
};

export const getUsername = (item) => {
  return item?.user?.username || item?.username || "";
};

export const normalizeApiResponse = (response, dataKey = null) => {
  if (!response) return null;

  if (dataKey) {
    return response[dataKey] || response || null;
  }

  return response;
};

export const normalizeArrayResponse = (response, arrayKey) => {
  if (!response) return [];
  return response[arrayKey] || response || [];
};

export const getFollowersCount = (user) => {
  return user?.stats?.followers || user?.followersCount || 0;
};

export const getFollowingCount = (user) => {
  return user?.stats?.following || user?.followingCount || 0;
};

export const getPostsCount = (user) => {
  return user?.stats?.posts || user?.postsCount || 0;
};

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? "s" : ""} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} week${diffInWeeks > 1 ? "s" : ""} ago`;
  }

  const options = { year: "numeric", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
};
