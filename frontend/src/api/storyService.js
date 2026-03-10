import axios from "./axios";

const storyService = {
  getAllStories: async () => {
    try {
      const response = await axios.get("/stories");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getUserStories: async (userId) => {
    try {
      const response = await axios.get(`/stories/user/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  createStory: async (storyData) => {
    try {
      const response = await axios.post("/stories", {
        image: storyData.image,
        caption: storyData.caption || "",
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getStoryViewers: async (storyId) => {
    try {
      const response = await axios.get(`/stories/${storyId}/viewers`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  viewStory: async (storyId) => {
    try {
      const response = await axios.post(`/stories/${storyId}/view`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteStory: async (storyId) => {
    try {
      const response = await axios.delete(`/stories/${storyId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default storyService;
