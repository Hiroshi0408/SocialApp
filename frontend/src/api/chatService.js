import axios from "./axios";
import { API_DEFAULTS } from "../constants";

const chatService = {
  getConversations: async () => {
    try {
      const response = await axios.get("/chat/conversations");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getOrCreateConversation: async (userId) => {
    try {
      const response = await axios.get(`/chat/conversations/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getMessages: async (
    conversationId,
    page = API_DEFAULTS.PAGINATION.DEFAULT_PAGE,
    limit = API_DEFAULTS.PAGINATION.MESSAGES_PER_PAGE
  ) => {
    try {
      const response = await axios.get(
        `/chat/conversations/${conversationId}/messages`,
        {
          params: { page, limit },
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  sendMessage: async (conversationId, content, messageType = "text", mediaUrl = null) => {
    try {
      const response = await axios.post(
        `/chat/conversations/${conversationId}/messages`,
        {
          content,
          messageType,
          mediaUrl,
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  markAsRead: async (conversationId) => {
    try {
      const response = await axios.put(
        `/chat/conversations/${conversationId}/read`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default chatService;