import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { User } from '../types';

/**
 * Refresh tokens stored in sessionStorage (cleared on tab close).
 * Access tokens are held in memory only — never persisted.
 */
const REFRESH_TOKEN_KEY = 'lab_portal_refresh_token';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    full_name: string;
    student_id?: string;
  }) => Promise<string>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await apiClient.login(email, password);
      apiClient.setAccessToken(resp.access_token);
      sessionStorage.setItem(REFRESH_TOKEN_KEY, resp.refresh_token);
      set({ user: resp.user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const resp = await apiClient.register(data);
      set({ isLoading: false });
      return resp.message;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (refreshToken) {
      try {
        await apiClient.logout(refreshToken);
      } catch {
        // Best-effort revocation
      }
    }
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    apiClient.setAccessToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  restoreSession: async () => {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      set({ isLoading: false });
      return;
    }

    try {
      const tokens = await apiClient.refresh(refreshToken);
      apiClient.setAccessToken(tokens.access_token);
      sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);

      const { user } = await apiClient.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      // Refresh failed — clear stale token
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      apiClient.setAccessToken(null);
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// Set up token auto-refresh (every 12 minutes for 15m-lived tokens).
// Routes through apiClient.refresh() which deduplicates concurrent refresh
// attempts, preventing token rotation races with 401-triggered refreshes.
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

setInterval(async () => {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) return;

  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return;

  const ok = await apiClient.scheduledRefresh();
  if (!ok) {
    useAuthStore.getState().logout();
  }
}, REFRESH_INTERVAL_MS);
