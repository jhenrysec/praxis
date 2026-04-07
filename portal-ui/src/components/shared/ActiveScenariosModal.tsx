import { useState } from 'react';
import { AlertTriangle, Server, Trash2, Rocket, X } from 'lucide-react';
import type { LabSlot } from '../../types';

interface ActiveScenariosModalProps {
  activeSlots: LabSlot[];
  targetSlot: number | 'all';
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

  const targetLabel =
    targetSlot === 'all' ? 'all assigned slots' : `slot #${targetSlot}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: 'rgba(250, 204, 21, 0.1)' }}>
            <AlertTriangle size={18} style={{ color: 'var(--accent-amber, #facc15)' }} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold">Active Scenarios Detected</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {activeSlots.length} slot{activeSlots.length !== 1 ? 's' : ''} currently running
            </p>
          </div>
          <button
            onClick={onCancel}
            className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            You're deploying{' '}
            <span className="text-[var(--text-primary)] font-medium">{scenarioName}</span> to{' '}
            <span className="font-medium" style={{ color: 'var(--accent-green, #00e5a0)' }}>{targetLabel}</span>.
            The following scenarios are already running. Would you like to shut them down first?
          </p>

          {/* Active slots list */}
          <div className="mb-4 max-h-48 space-y-1.5 overflow-y-auto">
            {activeSlots.map((slot) => {
              const isChecked = selected.has(slot.slot_number);
              const statusColor =
                slot.status === 'running'
                  ? '#00e5a0'
                  : slot.status === 'deploying'
                    ? '#facc15'
                    : '#4b5563';

              return (
                <label
                  key={slot.slot_number}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-all ${
                    isChecked
                      ? 'border-[var(--accent-red,#fb7185)] bg-[#fb71850d]'
                      : 'border-[var(--border-default)] bg-[var(--bg-base)] hover:border-[var(--border-active)]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSlot(slot.slot_number)}
                    className="h-3.5 w-3.5 rounded accent-[#fb7185]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="label-mono text-[var(--text-primary)]">
                        SLOT #{slot.slot_number}
                      </span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase"
                        style={{
                          backgroundColor: `${statusColor}1a`,
                          color: statusColor,
                          border: `1px solid ${statusColor}33`,
                        }}
                      >
                        {slot.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                      {slot.scenario_id ?? 'unknown scenario'}
                      {slot.deployed_at && (
                        <> &middot; deployed {new Date(slot.deployed_at).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Select all/none */}
          <div className="mb-2 flex gap-3 text-[10px]">
            <button
              onClick={selectAll}
              className="text-[var(--accent-blue,#6c8fff)] hover:opacity-80 transition-opacity"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-[var(--accent-blue,#6c8fff)] hover:opacity-80 transition-opacity"
            >
              Select None
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 border-t border-[var(--border-default)] px-5 py-4">
          {/* Shut down and deploy */}
          <button
            onClick={handleShutdownAndDeploy}
            disabled={selected.size === 0}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
              confirming
                ? 'bg-[var(--accent-red,#fb7185)] text-[var(--bg-base)] hover:opacity-90'
                : 'bg-[#fb71851a] border border-[#fb718533] text-[var(--accent-red,#fb7185)] hover:bg-[#fb71852a]'
            }`}
          >
            <Trash2 size={14} />
            {confirming
              ? `Confirm: Destroy ${selected.size} slot${selected.size !== 1 ? 's' : ''} then deploy`
              : `Shut down ${selected.size} slot${selected.size !== 1 ? 's' : ''} and deploy`}
          </button>

          {/* Deploy anyway */}
          <button
            onClick={onDeployAnyway}
            className="flex w-full items-center justify-center gap-2 bg-[var(--accent-green,#00e5a0)] text-[var(--bg-base)] rounded-lg px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Rocket size={14} />
            Deploy anyway — keep existing scenarios
          </button>

          {/* Cancel */}
          <button
            onClick={onCancel}
            className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
