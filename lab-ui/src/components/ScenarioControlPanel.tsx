import { useState } from 'react';
import {
  Rocket, Power, PowerOff, RotateCcw, Trash2, AlertTriangle, Stethoscope, Loader2,
} from 'lucide-react';
import type { LabSlot, Scenario, SlotStatus } from '@/types';
import { StatusBadge } from './StatusBadge';

type MutationLike = { isPending: boolean };

interface ScenarioControlPanelProps {
  slot: LabSlot;
  scenarios: Scenario[];
  deployScenarioId: string;
  onDeployScenarioChange: (id: string) => void;
  onDeploy: () => void;
  onShutdown: () => void;
  onStart: () => void;
  onReset: () => void;
  onDestroy: () => void;
  onForceDestroy: () => void;
  onToggleDiagnostics: () => void;
  diagnosticsOpen: boolean;
  mutations: {
    deploy: MutationLike;
    shutdown: MutationLike;
    start: MutationLike;
    reset: MutationLike;
    destroy: MutationLike;
    forceDestroy: MutationLike;
  };
}

const TRANSITIONAL: ReadonlySet<SlotStatus> = new Set<SlotStatus>([
  'deploying', 'starting', 'stopping', 'configuring', 'resetting', 'destroying',
]);

export function ScenarioControlPanel({
  slot,
  scenarios,
  deployScenarioId,
  onDeployScenarioChange,
  onDeploy,
  onShutdown,
  onStart,
  onReset,
  onDestroy,
  onForceDestroy,
  onToggleDiagnostics,
  diagnosticsOpen,
  mutations,
}: ScenarioControlPanelProps) {
  const [confirm, setConfirm] = useState<null | 'destroy' | 'forceDestroy' | 'reset' | 'shutdown'>(null);

  const inTransition = TRANSITIONAL.has(slot.status);
  const anyPending =
    mutations.deploy.isPending ||
    mutations.shutdown.isPending ||
    mutations.start.isPending ||
    mutations.reset.isPending ||
    mutations.destroy.isPending ||
    mutations.forceDestroy.isPending;
  const busy = inTransition || anyPending;

  const runConfirmed = (action: () => void) => {
    action();
    setConfirm(null);
  };

  return (
    <div className="space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={slot.status} />
          {inTransition && (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Loader2 className="w-3 h-3 animate-spin" /> operation in progress
            </span>
          )}
        </div>
        <button
          onClick={onToggleDiagnostics}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
            diagnosticsOpen
              ? 'border-[var(--accent-blue)] text-[var(--accent-blue)] bg-[#6c8fff1a]'
              : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
          }`}
          aria-label="Toggle diagnostics"
        >
          <Stethoscope className="w-3.5 h-3.5" /> Diagnostics
        </button>
      </div>

      {/* Error banner */}
      {slot.last_error && (
        <div className="flex items-start gap-2 bg-[#fb71851a] border border-[#fb718533] rounded-lg px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 text-[var(--accent-red)] flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-semibold text-[var(--accent-red)] mb-0.5">Last error</div>
            <div className="text-[var(--text-secondary)] break-words whitespace-pre-wrap">
              {slot.last_error}
            </div>
          </div>
        </div>
      )}

      {/* Action row — dispatched on status */}
      {slot.status === 'empty' && (
        <DeployRow
          scenarios={scenarios}
          value={deployScenarioId}
          onChange={onDeployScenarioChange}
          onDeploy={onDeploy}
          disabled={busy}
          pending={mutations.deploy.isPending}
        />
      )}

      {slot.status === 'running' && (
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={<PowerOff className="w-4 h-4" />}
            label="Shutdown"
            variant="blue"
            disabled={busy}
            pending={mutations.shutdown.isPending}
            confirm={confirm === 'shutdown'}
            onClick={() => setConfirm('shutdown')}
            onConfirm={() => runConfirmed(onShutdown)}
            onCancel={() => setConfirm(null)}
          />
          <ActionButton
            icon={<RotateCcw className="w-4 h-4" />}
            label="Reset"
            variant="purple"
            disabled={busy}
            pending={mutations.reset.isPending}
            confirm={confirm === 'reset'}
            onClick={() => setConfirm('reset')}
            onConfirm={() => runConfirmed(onReset)}
            onCancel={() => setConfirm(null)}
          />
          <ActionButton
            icon={<Trash2 className="w-4 h-4" />}
            label="Destroy"
            variant="red"
            disabled={busy}
            pending={mutations.destroy.isPending}
            confirm={confirm === 'destroy'}
            onClick={() => setConfirm('destroy')}
            onConfirm={() => runConfirmed(onDestroy)}
            onCancel={() => setConfirm(null)}
          />
        </div>
      )}

      {slot.status === 'stopped' && (
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={<Power className="w-4 h-4" />}
            label="Start"
            variant="green"
            disabled={busy}
            pending={mutations.start.isPending}
            onClick={onStart}
          />
          <ActionButton
            icon={<RotateCcw className="w-4 h-4" />}
            label="Reset"
            variant="purple"
            disabled={busy}
            pending={mutations.reset.isPending}
            confirm={confirm === 'reset'}
            onClick={() => setConfirm('reset')}
            onConfirm={() => runConfirmed(onReset)}
            onCancel={() => setConfirm(null)}
          />
          <ActionButton
            icon={<Trash2 className="w-4 h-4" />}
            label="Destroy"
            variant="red"
            disabled={busy}
            pending={mutations.destroy.isPending}
            confirm={confirm === 'destroy'}
            onClick={() => setConfirm('destroy')}
            onConfirm={() => runConfirmed(onDestroy)}
            onCancel={() => setConfirm(null)}
          />
        </div>
      )}

      {slot.status === 'error' && (
        <div className="space-y-2">
          <DeployRow
            scenarios={scenarios}
            value={deployScenarioId}
            onChange={onDeployScenarioChange}
            onDeploy={onDeploy}
            disabled={busy}
            pending={mutations.deploy.isPending}
            label="Redeploy"
          />
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<Trash2 className="w-4 h-4" />}
              label="Destroy"
              variant="red"
              disabled={busy}
              pending={mutations.destroy.isPending}
              confirm={confirm === 'destroy'}
              onClick={() => setConfirm('destroy')}
              onConfirm={() => runConfirmed(onDestroy)}
              onCancel={() => setConfirm(null)}
            />
            <ActionButton
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Force Destroy"
              variant="red"
              disabled={busy}
              pending={mutations.forceDestroy.isPending}
              confirm={confirm === 'forceDestroy'}
              onClick={() => setConfirm('forceDestroy')}
              onConfirm={() => runConfirmed(onForceDestroy)}
              onCancel={() => setConfirm(null)}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Force destroy bypasses normal cleanup — use when ordinary destroy has failed.
          </p>
        </div>
      )}

      {inTransition && (
        <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-muted)]">
          Slot is {slot.status}. Controls are disabled until the operation completes.
        </div>
      )}
    </div>
  );
}

interface DeployRowProps {
  scenarios: Scenario[];
  value: string;
  onChange: (id: string) => void;
  onDeploy: () => void;
  disabled: boolean;
  pending: boolean;
  label?: string;
}

function DeployRow({ scenarios, value, onChange, onDeploy, disabled, pending, label = 'Deploy' }: DeployRowProps) {
  return (
    <div className="flex gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm disabled:opacity-50"
        aria-label="Select scenario to deploy"
      >
        <option value="">Select scenario...</option>
        {scenarios.map((s) => (
          <option key={s.name} value={s.name}>{s.display_name}</option>
        ))}
      </select>
      <button
        onClick={onDeploy}
        disabled={!value || disabled}
        className="flex items-center gap-2 bg-[var(--accent-green)] text-[var(--bg-base)] px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
        aria-label={label}
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
        {label}
      </button>
    </div>
  );
}

type Variant = 'green' | 'blue' | 'purple' | 'red';

const VARIANT_STYLES: Record<Variant, string> = {
  green: 'bg-[#00e5a01a] border-[#00e5a033] text-[var(--accent-green)] hover:bg-[#00e5a02a]',
  blue: 'bg-[#6c8fff1a] border-[#6c8fff33] text-[var(--accent-blue)] hover:bg-[#6c8fff2a]',
  purple: 'bg-[#a78bfa1a] border-[#a78bfa33] text-[var(--accent-purple)] hover:bg-[#a78bfa2a]',
  red: 'bg-[#fb71851a] border-[#fb718533] text-[var(--accent-red)] hover:bg-[#fb71852a]',
};

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  variant: Variant;
  disabled: boolean;
  pending: boolean;
  confirm?: boolean;
  onClick: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

function ActionButton({ icon, label, variant, disabled, pending, confirm, onClick, onConfirm, onCancel }: ActionButtonProps) {
  if (confirm && onConfirm && onCancel) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={onConfirm}
          disabled={disabled}
          className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 ${VARIANT_STYLES[variant]}`}
          aria-label={`Confirm ${label}`}
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
          Confirm {label}
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-2 rounded-lg border border-[var(--border-default)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          aria-label={`Cancel ${label}`}
        >
          Cancel
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm disabled:opacity-40 ${VARIANT_STYLES[variant]}`}
      aria-label={label}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
