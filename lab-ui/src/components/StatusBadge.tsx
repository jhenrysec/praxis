import type { SlotStatus, VMState } from '@/types';
import { STATUS_COLORS, VM_STATE_COLORS } from '@/types';

interface StatusBadgeProps {
  status: SlotStatus | VMState;
  variant?: 'slot' | 'vm';
}

export function StatusBadge({ status, variant = 'slot' }: StatusBadgeProps) {
  const colors = variant === 'vm'
    ? VM_STATE_COLORS[status as VMState] ?? VM_STATE_COLORS.unknown
    : STATUS_COLORS[status as SlotStatus] ?? STATUS_COLORS.empty;

  return (
    <span
      className="label-mono inline-flex items-center gap-1.5 rounded px-2 py-0.5"
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
      aria-label={`Status: ${status}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          status === 'running' || status === 'deploying' ? 'animate-pulse-green' : ''
        }`}
        style={{ backgroundColor: colors.text }}
      />
      {status}
    </span>
  );
}
