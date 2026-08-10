import { create } from 'zustand';
import { useAuth } from './authStore';

/**
 * Theme store: keeps the current mode, flips the .dark class on <html>
 * and syncs the preference to the backend so it survives new logins.
 */
export const useTheme = create((set, get) => ({
  theme: 'light',

  apply: (theme) => {
    set({ theme });
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },

  init: async () => {
    // instant local restore before the server responds
    const saved = localStorage.getItem('theme');
    if (saved) get().apply(saved);
    // then the user's persisted preference wins
    const user = useAuth.getState().user;
    if (user?.theme) get().apply(user.theme);
  },

  toggle: async () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().apply(next);
    localStorage.setItem('theme', next);
    await useAuth.getState().saveTheme(next);
  },
}));