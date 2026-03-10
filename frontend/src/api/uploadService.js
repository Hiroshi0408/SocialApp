import axios from "./axios";

const uploadService = {
  uploadImage: async (file) => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await axios.post("/upload/image", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  uploadVideo: async (file) => {
    try {
      const formData = new FormData();
      formData.append("video", file);

      const response = await axios.post("/upload/video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 300000, 
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  uploadMedia: async (file) => {
    try {
      const formData = new FormData();
      formData.append("media", file);

      const response = await axios.post("/upload/media", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 300000,
      });

      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default uploadService;