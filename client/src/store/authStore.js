import { create } from 'zustand';
import { auth } from '../api/client';

/**
 * Auth store: current user, loading flag, login/logout actions.
 * Theme preference is also owned here because it lives on the User model.
 */
export const useAuth = create((set, get) => ({
  user: null,
  loading: true, // true while we re-check /auth/me on app start

  /** Fetch the session; returns boolean so routes can redirect. */
  fetchMe: async () => {
    try {
      const { user } = await auth.me();
      set({ user, loading: false });
      return true;
    } catch {
      set({ user: null, loading: false });
      return false;
    }
  },

  /** Sign in with email + password. Throws on failure (message shown by caller). */
  login: async (email, password) => {
    const { user } = await auth.login({ email, password });
    set({ user });
  },

  /** Create an account — logs the new user in immediately. */
  signup: async (name, email, password) => {
    const { user } = await auth.signup({ name, email, password });
    set({ user });
  },

  logout: async () => {
    const { user } = get();
    if (user) await auth.logout().catch(() => {});
    set({ user: null });
  },

  saveTheme: async (theme) => {
    set((s) => ({ user: s.user ? { ...s.user, theme } : s.user }));
    await auth.saveTheme(theme).catch(() => {});
  },
}));