import { create } from "zustand";
import type { ContentFilters, Theme } from "@shared/types/domain";

export interface ToastMessage {
  id: string;
  title: string;
  action?: { label: string; onClick: () => void };
}

interface UIState {
  sidebarCollapsed: boolean;
  theme: Theme;
  contentDialog: { open: boolean; contentId?: string; date?: string; quick?: boolean };
  filters: ContentFilters;
  toasts: ToastMessage[];
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
  openContentDialog: (options?: { contentId?: string; date?: string; quick?: boolean }) => void;
  closeContentDialog: () => void;
  setFilters: (filters: ContentFilters) => void;
  clearFilters: () => void;
  pushToast: (toast: Omit<ToastMessage, "id">) => void;
  dismissToast: (id: string) => void;
}

const storedSidebar = localStorage.getItem("rooznegar.sidebar") === "collapsed";
const storedTheme = (localStorage.getItem("rooznegar.theme") as Theme | null) ?? "light";

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: storedSidebar,
  theme: storedTheme,
  contentDialog: { open: false },
  filters: {},
  toasts: [],
  toggleSidebar: () => set((state) => {
    const sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem("rooznegar.sidebar", sidebarCollapsed ? "collapsed" : "expanded");
    return { sidebarCollapsed };
  }),
  setTheme: (theme) => { localStorage.setItem("rooznegar.theme", theme); set({ theme }); },
  openContentDialog: (options = {}) => set({ contentDialog: { open: true, ...options } }),
  closeContentDialog: () => set({ contentDialog: { open: false } }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    window.setTimeout(() => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })), 6000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
