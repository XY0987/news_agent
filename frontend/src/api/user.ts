import apiClient from "./client";
import type { User, UserProfile, UserPreferences } from "@/types";

export interface CreateUserParams {
  email: string;
  name: string;
  profile?: Partial<UserProfile>;
  preferences?: Partial<UserPreferences>;
}

export const userApi = {
  create(params: CreateUserParams) {
    return apiClient.post<{ data: User }>("/users", params).then((r) => r.data);
  },

  getAll() {
    return apiClient.get<{ data: User[] }>("/users").then((r) => r.data);
  },

  getById(id: string) {
    return apiClient.get<{ data: User }>(`/users/${id}`).then((r) => r.data);
  },

  update(id: string, data: Partial<User>) {
    return apiClient.put<{ data: User }>(`/users/${id}`, data).then((r) => r.data);
  },

  updateProfile(id: string, profile: Partial<UserProfile>) {
    return apiClient
      .patch<{ data: User }>(`/users/${id}/profile`, profile)
      .then((r) => r.data);
  },

  updatePreferences(id: string, preferences: Partial<UserPreferences>) {
    return apiClient
      .patch<{ data: User }>(`/users/${id}/preferences`, preferences)
      .then((r) => r.data);
  },

  updateNotificationSettings(id: string, settings: Record<string, unknown>) {
    return apiClient
      .patch<{ data: User }>(`/users/${id}/notification-settings`, settings)
      .then((r) => r.data);
  },

  delete(id: string) {
    return apiClient.delete(`/users/${id}`).then((r) => r.data);
  },
};
