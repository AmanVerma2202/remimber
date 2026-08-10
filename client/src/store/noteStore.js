import { create } from 'zustand';
import { notes } from '../api/client';

/**
 * Note store: dashboard list + the editor's working note.
 * The editor keeps the live element edits here and autosaves on a timer.
 */
export const useNotes = create((set, get) => ({
  list: [],
  total: 0,
  page: 1,
  loading: false,
  active: null,
  dirty: false,

  fetchList: async (params = {}) => {
    set({ loading: true });
    try {
      const data = await notes.list(params);
      set({ list: data.notes, total: data.total, page: data.page, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setActive: (note) => set({ active: note, dirty: false }),

  /** Optimistic in-memory save; the editor autosaves on a debounce. */
  updateActive: (patch) =>
    set((s) => (s.active ? { active: { ...s.active, ...patch }, dirty: true } : {})),

  /** Persist the active note to the server. */
  saveActive: async () => {
    const { active } = get();
    if (!active || !get().dirty) return;
    try {
      const { note } = await notes.update(active.id, active);
      set({ active: note, dirty: false, lastNote: note });
    } catch {
      /* keep dirty true so the next autosave retries */
    }
  },

  create: async (title = 'Untitled') => {
    const { note } = await notes.create(title);
    set((s) => ({ list: [note, ...s.list], total: s.total + 1 }));
    return note;
  },

  remove: async (id) => {
    await notes.remove(id);
    set((s) => ({ list: s.list.filter((n) => n.id !== id), total: s.total - 1 }));
  },

  /** Optimistic pin/unpin; the dashboard re-sorts pinned notes to the front. */
  togglePin: async (id) => {
    const { list } = get();
    const note = list.find((n) => n.id === id);
    if (!note) return;
    const pinned = !note.isPinned;
    set((s) => ({
      list: s.list
        .map((n) => (n.id === id ? { ...n, isPinned: pinned } : n))
        .sort((a, b) => b.isPinned - a.isPinned || +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0)),
    }));
    try {
      const { note: saved } = await notes.update(id, { isPinned: pinned });
      set((s) => ({ list: s.list.map((n) => (n.id === id ? { ...n, isPinned: saved.isPinned } : n)) }));
    } catch {
      set((s) => ({ list: s.list.map((n) => (n.id === id ? { ...n, isPinned: !pinned } : n)) }));
    }
  },
}));