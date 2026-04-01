import type { LabSlot } from '@/types';
import { StatusBadge } from './StatusBadge';

interface SlotGridProps {
  slots: LabSlot[];
  selectedSlot: number | null;
  onSelectSlot: (slot: number) => void;
}

export function SlotGrid({ slots, selectedSlot, onSelectSlot }: SlotGridProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-10">
      {slots.map((slot) => {
        const isSelected = slot.slot_number === selectedSlot;
        const isEmpty = slot.status === 'empty';

        return (
          <button
            key={slot.slot_number}
            onClick={() => onSelectSlot(slot.slot_number)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-all ${
              isSelected
                ? 'border-[#00e5a0] bg-[#00e5a00d]'
                : 'border-[#1e2228] bg-[#0d1017] hover:border-[#2d3139] hover:bg-[#131820]'
            }`}
            aria-label={`Slot ${slot.slot_number}: ${slot.status}`}
          >
            <span className={`font-heading text-lg font-bold ${
              isSelected ? 'text-[#00e5a0]' : isEmpty ? 'text-[#4b5563]' : 'text-[#e6edf3]'
            }`}>
              {String(slot.slot_number).padStart(2, '0')}
            </span>
            <StatusBadge status={slot.status} />
            {slot.scenario_name && (
              <span className="mt-1 max-w-full truncate text-[9px] text-[#8b949e]">
                {slot.scenario_name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
