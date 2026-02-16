import apiClient from "./client";
import type { Content, Feedback } from "@/types";

export interface ContentQueryParams {
  page?: number;
  pageSize?: number;
  userId?: string;
  sourceId?: string;
  sourceType?: string;
  startDate?: string;
  endDate?: string;
}

export interface ContentListResponse {
  data: Content[];
  total: number;
  page: number;
  pageSize: number;
}

export const contentApi = {
  getAll(params: ContentQueryParams) {
    return apiClient
      .get<ContentListResponse>("/contents", { params })
      .then((r) => r.data);
  },

  getDigest(userId: string) {
    return apiClient
      .get<{ data: Content[] }>("/contents/digest", { params: { userId } })
      .then((r) => r.data);
  },

  getById(id: string, userId?: string) {
    return apiClient
      .get<{ data: Content }>(`/contents/${id}`, { params: { userId } })
      .then((r) => r.data);
  },

  submitFeedback(contentId: string, feedback: Feedback) {
    return apiClient
      .post(`/contents/${contentId}/feedback`, feedback)
      .then((r) => r.data);
  },
};

export const digestApi = {
  getAll(params: { userId: string; type?: string; page?: number; pageSize?: number }) {
    return apiClient.get("/digests", { params }).then((r) => r.data);
  },

  getToday(userId: string) {
    return apiClient
      .get("/digests/today", { params: { userId } })
      .then((r) => r.data);
  },

  getStats(userId: string, days?: number) {
    return apiClient
      .get("/digests/stats", { params: { userId, days } })
      .then((r) => r.data);
  },

  getById(id: string) {
    return apiClient.get(`/digests/${id}`).then((r) => r.data);
  },
};

export const feedbackApi = {
  getHistory(userId: string, days?: number) {
    return apiClient
      .get("/feedbacks", { params: { userId, days } })
      .then((r) => r.data);
  },

  getStats(userId: string, days?: number) {
    return apiClient
      .get("/feedbacks/stats", { params: { userId, days } })
      .then((r) => r.data);
  },
};
