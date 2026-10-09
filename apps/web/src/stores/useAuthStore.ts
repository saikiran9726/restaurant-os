import { create } from 'zustand';
import type { UserProfile } from '@restaurant-os/shared';
import { useConnectionStore } from './useConnectionStore.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSessionExpiredModalOpen: boolean;

  // Actions
  setSession: (user: UserProfile, accessToken: string) => void;
  clearSession: () => void;
  setSessionExpiredModalOpen: (open: boolean) => void;
  initSession: () => Promise<boolean>;
  login: (credentials: {
    username: string;
    credentialType: 'password' | 'pin';
    password?: string;
    pin?: string;
    deviceLabel?: string;
  }) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  isSessionExpiredModalOpen: false,

  setSession: (user, accessToken) => {
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
      isSessionExpiredModalOpen: false,
    });
  },

  clearSession: () => {
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  setSessionExpiredModalOpen: (open) => {
    set({ isSessionExpiredModalOpen: open });
  },

  initSession: async () => {
    set({ isLoading: true });
    try {
      const refreshed = await get().refresh();
      return refreshed;
    } catch {
      get().clearSession();
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (credentials) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.message || 'Failed to authenticate');
    }

    get().setSession(data.user, data.accessToken);
    return data.user;
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    } finally {
      get().clearSession();
    }
  },

  refresh: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        return false;
      }

      const data = await res.json();
      get().setSession(data.user, data.accessToken);
      return true;
    } catch {
      return false;
    }
  },
}));

if (typeof window !== 'undefined') {
  (window as unknown as { __AUTH_STORE__?: typeof useAuthStore }).__AUTH_STORE__ = useAuthStore;
}

/**
 * Authenticated API Fetch helper with automatic 401 refresh flow.
 */
export async function apiFetch<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const store = useAuthStore.getState();
  let token = store.accessToken;

  const baseUrl = useConnectionStore.getState().getBaseUrl();
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include',
  });

  // If 401 Unauthorized, attempt refresh once
  if (res.status === 401) {
    const refreshed = await store.refresh();
    if (refreshed) {
      token = useAuthStore.getState().accessToken;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      res = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include',
      });
    } else {
      // Trigger session expiry modal without destroying background state
      store.setSessionExpiredModalOpen(true);
      throw new Error('Session expired');
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.error?.message || `Request failed with status ${res.status}`);
  }

  return json as T;
}
