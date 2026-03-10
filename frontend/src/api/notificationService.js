import axios from "./axios";
import { API_DEFAULTS } from "../constants";

const notificationService = {
  getAllNotifications: async (
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.NOTIFICATIONS_PER_PAGE
  ) => {
    try {
      const response = await axios.get("/notifications", {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getUnreadCount: async () => {
    try {
      const response = await axios.get("/notifications/unread-count");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const response = await axios.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await axios.put("/notifications/read-all");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      const response = await axios.delete(`/notifications/${notificationId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default notificationService;
