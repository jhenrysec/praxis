import { create } from 'zustand';
import type { TerminalLine } from '@/types';

interface TerminalState {
  lines: TerminalLine[];
  isStreaming: boolean;
  activeSlot: number | null;
  addLine: (text: string, type?: TerminalLine['type']) => void;
  clear: () => void;
  setStreaming: (streaming: boolean, slot?: number) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  isStreaming: false,
  activeSlot: null,

  addLine: (text, type = 'stdout') =>
    set((state) => ({
      lines: [...state.lines, { timestamp: Date.now(), text, type }],
    })),

  clear: () => set({ lines: [] }),

  setStreaming: (streaming, slot) =>
    set({ isStreaming: streaming, activeSlot: slot ?? null }),
}));
