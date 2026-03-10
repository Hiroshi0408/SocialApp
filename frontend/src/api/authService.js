import axios from "./axios";

const authService = {
  register: async (userData) => {
    try {
      const response = await axios.post("/auth/register", {
        fullName: userData.fullName,
        username: userData.username,
        email: userData.email,
        password: userData.password,
      });

      if (response.data.success && response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  login: async (credentials) => {
    try {
      let response;

      if (credentials.googleToken) {
        response = await axios.post("/auth/google-login", {
          googleToken: credentials.googleToken,
          email: credentials.email,
          displayName: credentials.displayName,
          photoURL: credentials.photoURL,
        });
      } else {
        response = await axios.post("/auth/login", {
          username: credentials.username,
          password: credentials.password,
        });
      }

      if (response.data.success && response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await axios.post("/auth/logout");
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await axios.get("/auth/me");

      if (response.data.success) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
        return response.data.user;
      }

      return null;
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Get current user error:", error);
      }
      return null;
    }
  },

  getCachedUser: () => {
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error("Parse user error:", error);
      return null;
    }
  },

  isAuthenticated: () => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    return !!(token && user);
  },

  getToken: () => {
    return localStorage.getItem("token");
  },

  verifyEmail: async (token) => {
    try {
      const response = await axios.post(`/auth/verify-email/${token}`);

      if (response.data.success && response.data.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  resendVerification: async () => {
    try {
      const response = await axios.post("/auth/resend-verification");
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await axios.post("/auth/forgot-password", { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  resetPassword: async (token, password) => {
    try {
      const response = await axios.post(`/auth/reset-password/${token}`, {
        password,
      });

      if (response.data.success && response.data.token) {
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await axios.post("/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default authService;
