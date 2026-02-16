import apiClient from "./client";
import type { Source } from "@/types";

export interface CreateSourceParams {
  userId: string;
  type: string;
  identifier: string;
  name: string;
  config?: Record<string, unknown>;
}

export interface ValidateSourceParams {
  type: string;
  identifier: string;
}

export const sourceApi = {
  create(params: CreateSourceParams) {
    return apiClient.post<{ data: Source }>("/sources", params).then((r) => r.data);
  },

  getAll(userId?: string) {
    return apiClient
      .get<{ data: Source[] }>("/sources", { params: { userId } })
      .then((r) => r.data);
  },

  getById(id: string) {
    return apiClient.get<{ data: Source }>(`/sources/${id}`).then((r) => r.data);
  },

  getStats(id: string) {
    return apiClient.get(`/sources/${id}/stats`).then((r) => r.data);
  },

  update(id: string, data: Partial<Source>) {
    return apiClient
      .put<{ data: Source }>(`/sources/${id}`, data)
      .then((r) => r.data);
  },

  delete(id: string) {
    return apiClient.delete(`/sources/${id}`).then((r) => r.data);
  },

  validate(params: ValidateSourceParams) {
    return apiClient.post("/sources/validate", params).then((r) => r.data);
  },
};

export const wechatApi = {
  updateCredentials(token: string, cookie: string) {
    return apiClient
      .post("/wechat/credentials", { token, cookie })
      .then((r) => r.data);
  },

  getCredentialsStatus() {
    return apiClient.get("/wechat/credentials/status").then((r) => r.data);
  },

  search(query: string) {
    return apiClient
      .get("/wechat/search", { params: { query } })
      .then((r) => r.data);
  },

  validate(identifier: string, name?: string) {
    return apiClient
      .post("/wechat/validate", { identifier, name })
      .then((r) => r.data);
  },
};
