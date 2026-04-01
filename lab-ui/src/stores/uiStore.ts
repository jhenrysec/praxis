import { create } from 'zustand';
import type { ViewMode } from '@/types';

interface UIState {
  view: ViewMode;
  sidebarOpen: boolean;
  terminalOpen: boolean;
  setView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'dashboard',
  sidebarOpen: true,
  terminalOpen: false,
  setView: (view) => set({ view }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),
  setTerminalOpen: (open) => set({ terminalOpen: open }),
}));
