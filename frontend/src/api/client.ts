import axios from "axios";

const TOKEN_KEY = "news_agent_token";

const apiClient = axios.create({
  baseURL: "/api",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器：自动携带 Token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：统一错误处理 + 401 自动跳转
apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;
    if (data.code !== undefined && data.code !== 0) {
      return Promise.reject(new Error(data.message || "请求失败"));
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message =
      error.response?.data?.message || error.message || "网络异常";

    // 401 未认证：清除 Token 并跳转到登录页
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      // 避免在登录页循环跳转
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    console.error("API Error:", message);
    return Promise.reject(new Error(message));
  }
);

export default apiClient;

// Token 工具方法
export const tokenUtils = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY),
};
