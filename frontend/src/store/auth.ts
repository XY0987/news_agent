import { create } from "zustand";
import { authApi } from "@/api/auth";
import { tokenUtils } from "@/api/client";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    code: string
  ) => Promise<void>;
  logout: () => void;
  initAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: tokenUtils.get(),
  loading: false,
  initialized: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      const { accessToken, user } = res.data;
      tokenUtils.set(accessToken);
      set({ token: accessToken, user: user as User, loading: false });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      set({ error: msg, loading: false });
      throw e;
    }
  },

  register: async (
    name: string,
    email: string,
    password: string,
    code: string
  ) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.register({ name, email, password, code });
      const { accessToken, user } = res.data;
      tokenUtils.set(accessToken);
      set({ token: accessToken, user: user as User, loading: false });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      set({ error: msg, loading: false });
      throw e;
    }
  },

  logout: () => {
    tokenUtils.remove();
    set({ user: null, token: null });
    window.location.href = "/login";
  },

  initAuth: async () => {
    const token = tokenUtils.get();
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const res = await authApi.getMe();
      set({ user: res.data, token, initialized: true });
    } catch {
      tokenUtils.remove();
      set({ user: null, token: null, initialized: true });
    }
  },

  clearError: () => set({ error: null }),
}));
