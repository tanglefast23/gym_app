'use client';

import { create } from 'zustand';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { type ComponentType, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItemData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastState {
  toasts: ToastItemData[];
  addToast: (
    message: string,
    type: ToastType,
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

/** Map of toast id -> timeout handle, kept outside Zustand to avoid non-serializable state. */
const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type, duration = 3000) => {
    const id = crypto.randomUUID();
    const toast: ToastItemData = { id, message, type, duration };

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

interface ToastIconConfig {
  icon: ComponentType<{ size?: number; className?: string }>;
  colorClass: string;
}

const toastIconMap: Record<ToastType, ToastIconConfig> = {
  success: { icon: CheckCircle, colorClass: 'text-success' },
  error: { icon: AlertCircle, colorClass: 'text-danger' },
  info: { icon: Info, colorClass: 'text-accent' },
};

const ToastItem = ({ toast }: { toast: ToastItemData }) => {
  const removeToast = useToastStore((s) => s.removeToast);
  const { icon: Icon, colorClass } = toastIconMap[toast.type];

  const handleMouseEnter = useCallback(() => {
    // Pause auto-dismiss: clear the existing timer
    const timeoutId = timerMap.get(toast.id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timerMap.delete(toast.id);
    }
  }, [toast.id]);

  const handleMouseLeave = useCallback(() => {
    // Resume auto-dismiss with remaining time (use default 3s)
    if (!timerMap.has(toast.id)) {
      const timeoutId = setTimeout(() => {
        timerMap.delete(toast.id);
        removeToast(toast.id);
      }, 3000);
      timerMap.set(toast.id, timeoutId);
    }
  }, [toast.id, removeToast]);

  return (
    <div
      className={[
        'rounded-xl px-4 py-3',
        'bg-elevated border border-border',
        'text-text-primary text-sm',
        'shadow-lg',
        'animate-slide-in-right',
        'flex items-center gap-3',
      ].join(' ')}
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      <Icon size={20} className={`${colorClass} shrink-0`} />
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="flex h-[44px] w-[44px] items-center justify-center text-text-muted hover:text-text-secondary shrink-0 -mr-2"
        aria-label="Dismiss"
      >
        <X size={16} />
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
    <div
      className={[
        'fixed z-50 flex flex-col gap-2',
        // Centered and responsive (mobile-first), respects safe-area.
        'top-[calc(env(safe-area-inset-top)+1rem)] left-1/2 -translate-x-1/2',
        'w-[calc(100%-2rem)] max-w-sm',
      ].join(' ')}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
