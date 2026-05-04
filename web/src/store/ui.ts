import { create } from 'zustand';

export interface Toast {
  id: string;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  ttl?: number;
}

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
  confettiTrigger: number;
  fireConfetti: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),

  toasts: [],
  toast: (t) => {
    const id = crypto.randomUUID();
    const item: Toast = { id, ttl: 4000, ...t };
    set({ toasts: [...get().toasts, item] });
    if (item.ttl) {
      setTimeout(() => get().dismissToast(id), item.ttl);
    }
    return id;
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }),

  confettiTrigger: 0,
  fireConfetti: () => set({ confettiTrigger: get().confettiTrigger + 1 }),
}));

export const toast = {
  success: (title: string, message?: string) => useUI.getState().toast({ kind: 'success', title, message }),
  error:   (title: string, message?: string) => useUI.getState().toast({ kind: 'error',   title, message, ttl: 6000 }),
  info:    (title: string, message?: string) => useUI.getState().toast({ kind: 'info',    title, message }),
  warning: (title: string, message?: string) => useUI.getState().toast({ kind: 'warning', title, message }),
};
