import axios from "./axios";

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
    const response = await axios.patch(`/admin/organizations/${id}/verify`);
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
