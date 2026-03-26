import axios from "./axios";
import { API_DEFAULTS } from "../constants";

const postService = {
  getAllPosts: async (
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.POSTS_PER_PAGE,
  ) => {
    const response = await axios.get(`/posts`, {
      params: { page, limit },
    });
    return response.data;
  },

  getFeed: async (
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.POSTS_PER_PAGE,
    scope = "following",
  ) => {
    const response = await axios.get(`/posts/feed`, {
      params: { page, limit, scope },
    });
    return response.data;
  },

  getPostById: async (postId) => {
    const response = await axios.get(`/posts/${postId}`);
    return response.data;
  },

  getUserPosts: async (
    userId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.USER_POSTS_PER_PAGE,
  ) => {
    const response = await axios.get(`/users/${userId}/posts`, {
      params: { page, limit },
    });
    return response.data;
  },

  getTaggedPosts: async (
    userId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.USER_POSTS_PER_PAGE,
  ) => {
    const response = await axios.get(`/posts/tagged/${userId}`, {
      params: { page, limit },
    });
    return response.data;
  },

  createPost: async (postData) => {
    const response = await axios.post("/posts", {
      image: postData.image || "",
      video: postData.video || "",
      mediaType: postData.mediaType || "image",
      videoDuration: postData.videoDuration || 0,
      caption: postData.caption || "",
      location: postData.location || "",
      taggedUsers: postData.taggedUsers || [],
    });
    return response.data;
  },

  updatePost: async (postId, postData) => {
    const response = await axios.put(`/posts/${postId}`, {
      caption: postData.caption,
      location: postData.location,
      taggedUsers: postData.taggedUsers,
    });
    return response.data;
  },

  deletePost: async (postId) => {
    const response = await axios.delete(`/posts/${postId}`);
    return response.data;
  },

  toggleLike: async (postId) => {
    const response = await axios.post(`/posts/${postId}/like`);
    return response.data;
  },

  addComment: async (postId, commentData) => {
    const payload =
      typeof commentData === "string"
        ? { text: commentData.trim() }
        : {
            text: commentData.text.trim(),
            ...(commentData.parentCommentId && {
              parentCommentId: commentData.parentCommentId,
            }),
          };

    const response = await axios.post(`/posts/${postId}/comments`, payload);
    return response.data;
  },

  getComments: async (
    postId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.COMMENTS_PER_PAGE,
  ) => {
    const response = await axios.get(`/posts/${postId}/comments`, {
      params: { page, limit },
    });
    return response.data;
  },

  deleteComment: async (commentId) => {
    const response = await axios.delete(`/comments/${commentId}`);
    return response.data;
  },

  toggleCommentLike: async (commentId) => {
    const response = await axios.post(`/comments/${commentId}/like`);
    return response.data;
  },

  getCommentReplies: async (commentId) => {
    const response = await axios.get(`/comments/${commentId}/replies`);
    return response.data;
  },

  searchByHashtag: async (
    query,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.POSTS_PER_PAGE,
  ) => {
    const response = await axios.get("/posts/search/hashtag", {
      params: { q: query, page, limit },
    });
    return response.data;
  },
};

export default postService;
