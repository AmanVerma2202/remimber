import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Lightweight toast notifications — replaces window.alert/confirm everywhere.
const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, variant = 'info', duration = 2500) => {
    const id = ++idRef.current;
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const value = useMemo(() => ({
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-xl backdrop-blur animate-[toast-in_.2s_ease-out] ${
              t.variant === 'success' ? 'border-emerald-500/40 bg-emerald-600 text-white'
              : t.variant === 'error' ? 'border-rose-500/40 bg-rose-600 text-white'
              : 'border-panel bg-white text-slate-800'
            }`}
          >
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-xs">{ICONS[t.variant]}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}