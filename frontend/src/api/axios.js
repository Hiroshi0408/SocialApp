import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (token && userStr && config.url !== "/auth/me") {
      try {
        const user = JSON.parse(userStr);
        const tokenPayload = token.split(".")[1];
        if (tokenPayload) {
          const decoded = JSON.parse(atob(tokenPayload));

          if (decoded.id && user.id && decoded.id !== user.id) {
            console.warn(
              "Token/User mismatch detected! Token belongs to different user."
            );
            console.warn(
              `Token user ID: ${decoded.id}, LocalStorage user ID: ${user.id}`
            );
          }
        }
      } catch (e) {
        console.error("Error validating token/user match:", e);
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status } = error.response;
      const hasAuthHeader = !!error.config?.headers?.Authorization;

      if (status === 401 && hasAuthHeader) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/";
      }

      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;