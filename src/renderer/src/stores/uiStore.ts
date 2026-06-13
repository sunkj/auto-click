import { create } from 'zustand'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface UiStore {
  isDark: boolean
  toasts: Toast[]
  toggleTheme: () => void
  addToast: (toast: Toast) => void
  removeToast: (id: string) => void
}

export const useUiStore = create<UiStore>((set) => ({
  isDark: true,
  toasts: [],
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  addToast: (toast) => set((state) => ({ toasts: [...state.toasts, toast] })),
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
