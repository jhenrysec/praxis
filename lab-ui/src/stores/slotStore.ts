import { create } from 'zustand';
import type { LabSlot } from '@/types';

interface SlotState {
  slots: LabSlot[];
  selectedSlot: number | null;
  setSlots: (slots: LabSlot[]) => void;
  selectSlot: (slot: number | null) => void;
  updateSlotStatus: (slot: number, status: LabSlot['status']) => void;
}

export const useSlotStore = create<SlotState>((set) => ({
  slots: [],
  selectedSlot: null,
  setSlots: (slots) => set({ slots }),
  selectSlot: (slot) => set({ selectedSlot: slot }),
  updateSlotStatus: (slotNumber, status) =>
    set((state) => ({
      slots: state.slots.map((s) =>
        s.slot_number === slotNumber ? { ...s, status } : s,
      ),
    })),
}));
