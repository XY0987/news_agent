import { create } from "zustand";
import { userApi } from "@/api/user";
import { sourceApi } from "@/api/source";
import { contentApi } from "@/api/content";
import type {
  User,
  UserProfile,
  UserPreferences,
  Source,
  Content,
  Feedback,
} from "@/types";

// ========== User Store ==========
interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  fetchUser: (id: string) => Promise<void>;
  setUser: (user: User) => void;
  updateProfile: (id: string, profile: Partial<UserProfile>) => Promise<void>;
  updatePreferences: (
    id: string,
    prefs: Partial<UserPreferences>
  ) => Promise<void>;
  createUser: (
    email: string,
    name: string
  ) => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  error: null,

  fetchUser: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const res = await userApi.getById(id);
      set({ user: res.data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setUser: (user: User) => set({ user }),

  updateProfile: async (id: string, profile: Partial<UserProfile>) => {
    try {
      const res = await userApi.updateProfile(id, profile);
      set({ user: res.data });
    } catch (e: unknown) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  updatePreferences: async (id: string, prefs: Partial<UserPreferences>) => {
    try {
      const res = await userApi.updatePreferences(id, prefs);
      set({ user: res.data });
    } catch (e: unknown) {
      set({ error: (e as Error).message });
      throw e;
    }
  },

  createUser: async (email: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const res = await userApi.create({ email, name });
      set({ user: res.data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },
}));

// ========== Content Store ==========
interface ContentState {
  contents: Content[];
  digest: Content[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  fetchContents: (params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    sourceId?: string;
  }) => Promise<void>;
  fetchDigest: (userId: string) => Promise<void>;
  submitFeedback: (contentId: string, feedback: Feedback) => Promise<void>;
}

export const useContentStore = create<ContentState>((set) => ({
  contents: [],
  digest: [],
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  error: null,

  fetchContents: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await contentApi.getAll(params);
      set({
        contents: res.data,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        loading: false,
      });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  fetchDigest: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await contentApi.getDigest(userId);
      set({ digest: res.data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  submitFeedback: async (contentId: string, feedback: Feedback) => {
    try {
      await contentApi.submitFeedback(contentId, feedback);
      // 更新本地状态：标记已反馈
      set((state) => ({
        digest: state.digest.map((c) =>
          c.id === contentId ? { ...c, userFeedback: feedback.type } : c
        ),
        contents: state.contents.map((c) =>
          c.id === contentId ? { ...c, userFeedback: feedback.type } : c
        ),
      }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },
}));

// ========== Source Store ==========
interface SourceState {
  sources: Source[];
  loading: boolean;
  error: string | null;
  fetchSources: (userId?: string) => Promise<void>;
  createSource: (params: {
    userId: string;
    type: string;
    identifier: string;
    name: string;
    config?: Record<string, unknown>;
  }) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  updateSource: (id: string, data: Partial<Source>) => Promise<void>;
}

export const useSourceStore = create<SourceState>((set) => ({
  sources: [],
  loading: false,
  error: null,

  fetchSources: async (userId?: string) => {
    set({ loading: true, error: null });
    try {
      const res = await sourceApi.getAll(userId);
      set({ sources: res.data, loading: false });
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  createSource: async (params) => {
    set({ loading: true, error: null });
    try {
      const res = await sourceApi.create(params);
      set((state) => ({
        sources: [...state.sources, res.data],
        loading: false,
      }));
    } catch (e: unknown) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  deleteSource: async (id: string) => {
    try {
      await sourceApi.delete(id);
      set((state) => ({
        sources: state.sources.filter((s) => s.id !== id),
      }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },

  updateSource: async (id: string, data: Partial<Source>) => {
    try {
      const res = await sourceApi.update(id, data);
      set((state) => ({
        sources: state.sources.map((s) => (s.id === id ? res.data : s)),
      }));
    } catch (e: unknown) {
      set({ error: (e as Error).message });
    }
  },
}));
