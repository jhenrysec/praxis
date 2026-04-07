import { useState } from 'react';
import { AlertTriangle, Server, Trash2, Play, X } from 'lucide-react';
import type { LabSlot } from '@/types';
import { STATUS_COLORS } from '@/types';

interface ActiveScenariosModalProps {
  activeSlots: LabSlot[];
  targetSlot: number;
  scenarioName: string;
  onDeployAnyway: () => void;
  onShutdownAndDeploy: (slotsToDestroy: number[]) => void;
  onCancel: () => void;
}

export function ActiveScenariosModal({
  activeSlots,
  targetSlot,
  scenarioName,
  onDeployAnyway,
  onShutdownAndDeploy,
  onCancel,
}: ActiveScenariosModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(activeSlots.map((s) => s.slot_number)),
  );
  const [confirming, setConfirming] = useState(false);

  const toggleSlot = (slot: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) {
        next.delete(slot);
      } else {
        next.add(slot);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(activeSlots.map((s) => s.slot_number)));
  const selectNone = () => setSelected(new Set());

  const handleShutdownAndDeploy = () => {
    if (selected.size === 0) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    onShutdownAndDeploy(Array.from(selected));
  };

  const totalVMs = activeSlots.reduce((sum, s) => sum + (s.vms?.length ?? 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-[#1e2228] bg-[#0d1017] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[#1e2228] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#facc151a]">
            <AlertTriangle size={18} className="text-[#facc15]" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-base font-bold text-[#e6edf3]">
              Active Scenarios Detected
            </h2>
            <p className="text-xs text-[#8b949e]">
              {activeSlots.length} slot{activeSlots.length !== 1 ? 's' : ''} running
              {totalVMs > 0 ? ` \u00b7 ${totalVMs} VMs` : ''}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 text-[#4b5563] hover:bg-[#131820] hover:text-[#8b949e] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-4 text-sm text-[#8b949e]">
            You're deploying <span className="text-[#e6edf3] font-medium">{scenarioName}</span> to
            slot <span className="text-[#00e5a0] font-medium">{String(targetSlot).padStart(2, '0')}</span>.
            The following scenarios are already running:
          </p>

          {/* Active slots list */}
          <div className="mb-4 max-h-48 space-y-1.5 overflow-y-auto">
            {activeSlots.map((slot) => {
              const colors = STATUS_COLORS[slot.status];
              const isChecked = selected.has(slot.slot_number);

              return (
                <label
                  key={slot.slot_number}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                    isChecked
                      ? 'border-[#fb718533] bg-[#fb71850d]'
                      : 'border-[#1e2228] bg-[#0a0c0f] hover:border-[#2d3139]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSlot(slot.slot_number)}
                    className="h-3.5 w-3.5 rounded border-[#4b5563] bg-[#0a0c0f] accent-[#fb7185]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="label-mono text-[#e6edf3]">
                        SLOT {String(slot.slot_number).padStart(2, '0')}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        {slot.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-[#8b949e]">
                      <span>{slot.scenario_name ?? slot.scenario_id ?? 'unknown'}</span>
                      {slot.vms && slot.vms.length > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Server size={9} /> {slot.vms.length} VMs
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Select all/none */}
          <div className="mb-4 flex gap-3 text-[10px]">
            <button
              onClick={selectAll}
              className="text-[#6c8fff] hover:text-[#8ba8ff] transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-[#6c8fff] hover:text-[#8ba8ff] transition-colors"
            >
              Select None
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-[#1e2228] px-5 py-4">
          {/* Shut down selected + deploy */}
          <button
            onClick={handleShutdownAndDeploy}
            disabled={selected.size === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-30 ${
              confirming
                ? 'border border-[#fb7185] bg-[#fb71851a] text-[#fb7185] hover:bg-[#fb718533]'
                : 'border border-[#fb718533] bg-[#fb71850d] text-[#fb7185] hover:bg-[#fb71851a]'
            }`}
          >
            <Trash2 size={14} />
            {confirming
              ? `Confirm: Destroy ${selected.size} slot${selected.size !== 1 ? 's' : ''} then deploy`
              : `Shut down ${selected.size} slot${selected.size !== 1 ? 's' : ''} and deploy`}
          </button>

          {/* Deploy without shutting down */}
          <button
            onClick={onDeployAnyway}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00e5a033] bg-[#00e5a00d] px-4 py-2.5 text-xs font-semibold text-[#00e5a0] transition-all hover:bg-[#00e5a01a]"
          >
            <Play size={14} />
            Deploy anyway — keep existing scenarios running
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-[#1e2228] bg-[#0a0c0f] px-4 py-2 text-xs text-[#8b949e] transition-all hover:border-[#2d3139] hover:text-[#e6edf3]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
