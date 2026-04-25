import axios from "./axios";

// Tất cả endpoint mount tại /api/charity (xem backend/routes/charity.route.js).
// Public: list, detail, donations list, sync.
// Auth: create campaign, recordDonation (FE call sau khi user ký tx donate).
const charityService = {
  // Public — guest cũng gọi được
  listCampaigns: async (params = {}) => {
    const response = await axios.get("/charity/campaigns", { params });
    return response.data;
  },

  getCampaignDetail: async (id, { sync = false } = {}) => {
    const response = await axios.get(`/charity/campaigns/${id}`, {
      params: sync ? { sync: 1 } : {},
    });
    return response.data;
  },

  listDonations: async (id, params = {}) => {
    const response = await axios.get(`/charity/campaigns/${id}/donations`, {
      params,
    });
    return response.data;
  },

  syncFromChain: async (id) => {
    const response = await axios.post(`/charity/campaigns/${id}/sync`);
    return response.data;
  },

  // Auth
  listMyCampaigns: async (params = {}) => {
    const response = await axios.get("/charity/campaigns/mine", { params });
    return response.data;
  },

  createCampaign: async (payload) => {
    const response = await axios.post("/charity/campaigns", payload);
    return response.data;
  },

  recordDonation: async (id, payload) => {
    const response = await axios.post(
      `/charity/campaigns/${id}/donations/record`,
      payload
    );
    return response.data;
  },
};

export default charityService;
