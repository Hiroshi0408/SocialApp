import axios from "./axios";

// adminVerify trigger BE gọi charityService.whitelistOrgOnChain → await tx.wait().
// Cần timeout dài hơn 10s default, tương tự admin chain action khác.
const CHAIN_TX_TIMEOUT = 90000;

const organizationService = {
  // Public — guest cũng gọi được
  list: async (params = {}) => {
    const response = await axios.get("/organizations", { params });
    return response.data;
  },

  getBySlug: async (slug) => {
    const response = await axios.get(`/organizations/${slug}`);
    return response.data;
  },

  getMine: async () => {
    const response = await axios.get("/organizations/mine");
    return response.data;
  },

  apply: async (payload) => {
    const response = await axios.post("/organizations", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await axios.patch(`/organizations/${id}`, payload);
    return response.data;
  },

  // Admin
  adminList: async (params = {}) => {
    const response = await axios.get("/admin/organizations", { params });
    return response.data;
  },

  adminVerify: async (id) => {
    const response = await axios.patch(
      `/admin/organizations/${id}/verify`,
      {},
      { timeout: CHAIN_TX_TIMEOUT }
    );
    return response.data;
  },

  adminReject: async (id, reason = "") => {
    const response = await axios.patch(`/admin/organizations/${id}/reject`, {
      reason,
    });
    return response.data;
  },
};

export default organizationService;
