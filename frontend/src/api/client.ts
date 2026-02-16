import axios from "axios";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== undefined && data.code !== 0) {
      return Promise.reject(new Error(data.message || "请求失败"));
    }
    return response;
  },
  (error) => {
    const message =
      error.response?.data?.message || error.message || "网络异常";
    console.error("API Error:", message);
    return Promise.reject(new Error(message));
  }
);

export default apiClient;
