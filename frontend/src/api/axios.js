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

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
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
  },
);

export default axiosInstance;
