import axios from "./axios";
import { API_DEFAULTS } from "../constants";

const saveService = {
  savePost: async (postId) => {
    try {
      const response = await axios.post(`/saves/${postId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  unsavePost: async (postId) => {
    try {
      const response = await axios.delete(`/saves/${postId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSavedPosts: async (
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.POSTS_PER_PAGE
  ) => {
    try {
      const response = await axios.get("/saves", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  checkSaveStatus: async (postId) => {
    try {
      const response = await axios.get(`/saves/${postId}/status`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default saveService;
