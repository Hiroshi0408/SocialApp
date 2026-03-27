import axios from "./axios";

const groupService = {
  getJoinedGroups: async () => {
    const response = await axios.get("/groups/joined");
    return response.data;
  },

  getSuggestedGroups: async (limit = 10) => {
    const response = await axios.get("/groups/suggested", {
      params: { limit },
    });
    return response.data;
  },

  createGroup: async (payload) => {
    const response = await axios.post("/groups", payload);
    return response.data;
  },

  joinGroup: async (groupId) => {
    const response = await axios.post(`/groups/${groupId}/join`);
    return response.data;
  },

  leaveGroup: async (groupId) => {
    const response = await axios.post(`/groups/${groupId}/leave`);
    return response.data;
  },
};

export default groupService;
