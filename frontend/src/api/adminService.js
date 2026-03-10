import axios from "./axios";

const adminService = {
  getStats: async (days = 7) => {
    const response = await axios.get(`/admin/stats?days=${days}`);
    return response.data;
  },

  listUsers: async ({ page = 1, limit = 20, status = "all", role = "all", verified = "all", q = "" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    if (status) params.set("status", status);
    if (role) params.set("role", role);
    if (verified !== "all") params.set("verified", verified);
    if (q) params.set("q", q);

    const response = await axios.get(`/admin/users?${params.toString()}`);
    return response.data;
  },

  banUser: async (userId) => {
    const response = await axios.patch(`/admin/users/${userId}/ban`);
    return response.data;
  },

  unbanUser: async (userId) => {
    const response = await axios.patch(`/admin/users/${userId}/unban`);
    return response.data;
  },

  setUserRole: async (userId, role) => {
    const response = await axios.patch(`/admin/users/${userId}/role`, { role });
    return response.data;
  },

  listModerationPosts: async ({ page = 1, limit = 20, status = "active", q = "" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    params.set("status", status);
    if (q) params.set("q", q);

    const response = await axios.get(`/admin/moderation/posts?${params.toString()}`);
    return response.data;
  },

  deletePost: async (postId) => {
    const response = await axios.patch(`/admin/moderation/posts/${postId}/delete`);
    return response.data;
  },

  restorePost: async (postId) => {
    const response = await axios.patch(`/admin/moderation/posts/${postId}/restore`);
    return response.data;
  },

  listModerationComments: async ({ page = 1, limit = 20, status = "active", q = "" } = {}) => {
    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", limit);
    params.set("status", status);
    if (q) params.set("q", q);

    const response = await axios.get(`/admin/moderation/comments?${params.toString()}`);
    return response.data;
  },

  deleteComment: async (commentId) => {
    const response = await axios.patch(`/admin/moderation/comments/${commentId}/delete`);
    return response.data;
  },

  restoreComment: async (commentId) => {
    const response = await axios.patch(`/admin/moderation/comments/${commentId}/restore`);
    return response.data;
  },

  listAudit: async (limit = 50) => {
    const response = await axios.get(`/admin/audit?limit=${limit}`);
    return response.data;
  },
};

export default adminService;
