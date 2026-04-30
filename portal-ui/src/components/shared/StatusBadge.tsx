import type { SlotStatus, UserStatus } from '../../types';

type BadgeStatus = SlotStatus | UserStatus | string;

const COLORS: Record<string, { bg: string; text: string; border: string }> = {
  running:      { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' },
  active:       { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' },
  empty:        { bg: '#4b55631a', text: '#4b5563', border: '#4b556333' },
  stopped:      { bg: '#6c8fff1a', text: '#6c8fff', border: '#6c8fff33' },
  pending:      { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  deploying:    { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  starting:     { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  stopping:     { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  configuring:  { bg: '#a78bfa1a', text: '#a78bfa', border: '#a78bfa33' },
  resetting:    { bg: '#a78bfa1a', text: '#a78bfa', border: '#a78bfa33' },
  destroying:   { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  error:        { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  locked:       { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  deleted:      { bg: '#4b55631a', text: '#4b5563', border: '#4b556333' },
};

const PULSING = new Set<string>([
  'running', 'active',
  'deploying', 'starting', 'stopping', 'configuring', 'resetting', 'destroying',
]);

interface StatusBadgeProps {
  status: BadgeStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const color = COLORS[status] ?? { bg: '#6c8fff1a', text: '#6c8fff', border: '#6c8fff33' };
  const pulse = PULSING.has(status);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{ backgroundColor: color.bg, color: color.text, borderColor: color.border }}
    >
      {pulse && (
        <span
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color.text }}
        />
      )}
      {status.toUpperCase()}
    </span>
  );
}
