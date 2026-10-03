import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((message, tone = 'success') => {
    const id = nextId++;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  const value = useMemo(() => ({
    toast: push,
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }), [push]);

  const tones = {
    success: 'bg-emerald-600',
    error: 'bg-rose-600',
    info: 'bg-navy-700',
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Bottom-centred on phones (thumb reach), top-right on desktop. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4
                      sm:bottom-auto sm:right-4 sm:top-4 sm:items-end sm:px-0">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm animate-slide-up items-center gap-2 rounded-xl
                        px-4 py-3 text-left text-sm font-medium text-white shadow-lg ${tones[t.tone]}`}
          >
            <span className="flex-1">{t.message}</span>
            <span className="text-white/70">✕</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
