import type { SlotStatus, VMState } from '@/types';
import { STATUS_COLORS, VM_STATE_COLORS, PULSING_STATUSES } from '@/types';

interface StatusBadgeProps {
  status: SlotStatus | VMState | string;
  variant?: 'slot' | 'vm';
}

const FALLBACK = { bg: '#4b55631a', text: '#4b5563', border: '#4b556333' };

export function StatusBadge({ status, variant = 'slot' }: StatusBadgeProps) {
  const colors = variant === 'vm'
    ? (VM_STATE_COLORS[status as VMState] ?? FALLBACK)
    : (STATUS_COLORS[status as SlotStatus] ?? FALLBACK);

  const pulse = PULSING_STATUSES.has(status as SlotStatus | VMState);

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
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? 'animate-pulse-green' : ''}`}
        style={{ backgroundColor: colors.text }}
      />
      {status}
    </span>
  );
}
