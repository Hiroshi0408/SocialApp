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

  getGroupById: async (groupId) => {
    const response = await axios.get(`/groups/${groupId}`);
    return response.data;
  },

  createGroup: async (payload) => {
    const response = await axios.post("/groups", payload);
    return response.data;
  },

  updateGroup: async (groupId, payload) => {
    const response = await axios.patch(`/groups/${groupId}`, payload);
    return response.data;
  },

  deleteGroup: async (groupId) => {
    const response = await axios.delete(`/groups/${groupId}`);
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

  kickMember: async (groupId, userId) => {
    const response = await axios.delete(`/groups/${groupId}/members/${userId}`);
    return response.data;
  },

  transferOwnership: async (groupId, targetUserId) => {
    const response = await axios.post(
      `/groups/${groupId}/transfer-ownership`,
      { targetUserId },
    );
    return response.data;
  },
};

export default groupService;
