import { create } from 'zustand';

type ToastType = 'success' | 'error' | 'info';

export interface ToastItemData {
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

/** Default auto-dismiss durations by toast type. */
const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  error: 6000, // Errors persist longer so users and screen readers have time to read them.
};

/** Map of toast id -> timeout handle, kept outside Zustand to avoid non-serializable state. */
export const timerMap = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type, duration) => {
    const id = crypto.randomUUID();
    const effectiveDuration = duration ?? DEFAULT_DURATION[type];
    const toast: ToastItemData = { id, message, type, duration: effectiveDuration };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    const timeoutId = setTimeout(() => {
      timerMap.delete(id);
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, effectiveDuration);
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
