/**
 * API 客户端配置
 * 后端 API 基础地址: http://localhost:8000/api
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// TODO: 封装统一的 API 请求方法（带错误处理、Token 注入等）
export { API_BASE_URL };
