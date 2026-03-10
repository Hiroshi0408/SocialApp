import axios from "./axios";
import { API_DEFAULTS } from "../constants";

const userService = {
  getUserProfile: async (username) => {
    try {
      const response = await axios.get(`/users/profile/${username}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await axios.put("/users/profile", profileData);

      if (response.data.success) {
        const currentUser = localStorage.getItem("user");
        if (currentUser) {
          const user = JSON.parse(currentUser);
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...user,
              ...response.data.user,
            })
          );
        }
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  uploadAvatar: async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await axios.post("/upload/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success && response.data.user) {
        const currentUser = localStorage.getItem("user");
        if (currentUser) {
          const user = JSON.parse(currentUser);
          localStorage.setItem(
            "user",
            JSON.stringify({
              ...user,
              ...response.data.user,
            })
          );
        }
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  followUser: async (userId) => {
    try {
      const response = await axios.post(`/users/${userId}/follow`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  unfollowUser: async (userId) => {
    try {
      const response = await axios.delete(`/users/${userId}/follow`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getFollowers: async (
    userId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.FOLLOWERS_PER_PAGE
  ) => {
    try {
      const response = await axios.get(`/users/${userId}/followers`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getFollowing: async (
    userId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.FOLLOWING_PER_PAGE
  ) => {
    try {
      const response = await axios.get(`/users/${userId}/following`, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSuggestedUsers: async (limit = API_DEFAULTS.PAGINATION.SUGGESTIONS_LIMIT) => {
    try {
      const response = await axios.get("/users/suggestions", {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  searchUsers: async (
    query,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.SEARCH_RESULTS_PER_PAGE
  ) => {
    try {
      const response = await axios.get("/users/search", {
        params: { q: query, page, limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  checkFollowStatus: async (userId) => {
    try {
      const response = await axios.get(`/users/${userId}/follow-status`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default userService;
