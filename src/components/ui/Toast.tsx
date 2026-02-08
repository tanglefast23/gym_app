'use client';

import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (
    message: string,
    type: ToastType,
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

/** Map of toast id → timeout handle, kept outside Zustand to avoid non-serializable state. */
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type, duration = 3000) => {
    const id = crypto.randomUUID();
    const toast: ToastItem = { id, message, type, duration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    const timeoutId = setTimeout(() => {
      timerMap.delete(id);
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
    timerMap.set(id, timeoutId);
  },

  removeToast: (id) => {
    const timeoutId = timerMap.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timerMap.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

const borderColorMap: Record<ToastType, string> = {
  success: 'border-l-success',
  error: 'border-l-danger',
  info: 'border-l-accent',
};

const ToastItem = ({ toast }: { toast: ToastItem }) => {
  const { removeToast } = useToastStore((s) => ({
    removeToast: s.removeToast,
  }));

  return (
    <div
      className={[
        'rounded-xl px-4 py-3',
        'bg-elevated border border-border border-l-4',
        borderColorMap[toast.type],
        'text-text-primary text-sm',
        'shadow-lg',
        'animate-slide-in-right',
        'flex items-center justify-between gap-3',
      ].join(' ')}
      role="alert"
    >
      <span>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="text-text-muted hover:text-text-secondary shrink-0"
        aria-label="Dismiss"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
};

export const ToastContainer = () => {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
