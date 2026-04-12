import apiClient from "./client";
import type { User } from "@/types";

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
  code: string;
}

export interface SendCodeParams {
  email: string;
  scene: "register" | "reset";
}

export interface ResetPasswordParams {
  email: string;
  newPassword: string;
  code: string;
}

export interface AuthResponse {
  accessToken: string;
  user: Partial<User>;
}

export const authApi = {
  login(params: LoginParams) {
    return apiClient
      .post<{ data: AuthResponse }>("/auth/login", params)
      .then((r) => r.data);
  },

  register(params: RegisterParams) {
    return apiClient
      .post<{ data: AuthResponse }>("/auth/register", params)
      .then((r) => r.data);
  },

  sendCode(params: SendCodeParams) {
    return apiClient
      .post<{ data: { message: string } }>("/auth/send-code", params)
      .then((r) => r.data);
  },

  resetPassword(params: ResetPasswordParams) {
    return apiClient
      .post<{ data: { message: string } }>("/auth/reset-password", params)
      .then((r) => r.data);
  },

  getMe() {
    return apiClient.get<{ data: User }>("/auth/me").then((r) => r.data);
  },
};
