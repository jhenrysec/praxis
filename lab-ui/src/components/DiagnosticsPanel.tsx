import { AlertTriangle, CheckCircle2, Camera, Tag, Ghost, Clock, Loader2 } from 'lucide-react';
import { useSlotDiagnostics } from '@/hooks/useSlots';
import { StatusBadge } from './StatusBadge';
import type { VmDiagnostic } from '@/types';

interface DiagnosticsPanelProps {
  slot: number;
}

export function DiagnosticsPanel({ slot }: DiagnosticsPanelProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useSlotDiagnostics(slot, true);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] px-4 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading diagnostics…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-2 bg-[#fb71851a] border border-[#fb718533] rounded-lg px-3 py-2 text-xs">
        <AlertTriangle className="w-4 h-4 text-[var(--accent-red)] flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-[var(--accent-red)] mb-0.5">Diagnostics unavailable</div>
          <div className="text-[var(--text-secondary)] break-words">{(error as Error)?.message ?? 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const d = data;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Fact label="DB status" value={<StatusBadge status={d.db_status} />} />
        <Fact label="DB scenario" value={d.db_scenario_id ?? '—'} />
        <Fact label="VMs found" value={`${d.vm_count}`} />
        <Fact label="Workspace" value={d.workspace_expected ?? '—'} mono />
      </div>

      {/* Advisories */}
      {d.advisories.length > 0 ? (
        <div className="space-y-1.5">
          {d.advisories.map((msg, i) => (
            <div
              key={i}
              className="flex items-start gap-2 bg-[#facc151a] border border-[#facc1533] rounded-lg px-3 py-2 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-[var(--accent-amber)] flex-shrink-0 mt-0.5" />
              <span className="text-[var(--text-secondary)]">{msg}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 bg-[#00e5a01a] border border-[#00e5a033] rounded-lg px-3 py-2 text-xs">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent-green)]" />
          <span className="text-[var(--text-secondary)]">No advisories — slot state is coherent.</span>
        </div>
      )}

      {/* VMs without baseline */}
      {d.vms_without_baseline.length > 0 && (
        <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs">
          <div className="label-mono text-[var(--text-muted)] mb-1">VMs without baseline snapshot</div>
          <div className="flex flex-wrap gap-1.5">
            {d.vms_without_baseline.map((vmid) => (
              <span
                key={vmid}
                className="font-mono bg-[#facc151a] text-[var(--accent-amber)] border border-[#facc1533] rounded px-1.5 py-0.5"
              >
                {vmid}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* VM table */}
      <div>
        <div className="label-mono text-[var(--text-muted)] mb-1.5">Known VMs</div>
        {d.vms.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)] px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg">
            No VMs tagged for this slot.
          </div>
        ) : (
          <div className="space-y-1.5">
            {d.vms.map((vm) => <VmDiagnosticRow key={vm.vmid} vm={vm} />)}
          </div>
        )}
      </div>

      {/* Orphan VMs */}
      {d.orphan_vms.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 label-mono text-[var(--accent-amber)] mb-1.5">
            <Ghost className="w-3.5 h-3.5" /> Orphan VMs
          </div>
          <div className="space-y-1.5">
            {d.orphan_vms.map((vm) => <VmDiagnosticRow key={vm.vmid} vm={vm} orphan />)}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            These VMs carry this slot's tag but are not tracked by Terraform — consider Force Destroy.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)]">
        <span className="text-xs text-[var(--text-muted)]">Refreshes every 15s.</span>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline disabled:opacity-50"
        >
          {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
          Refresh now
        </button>
      </div>
    </div>
  );
}

interface FactProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}

function Fact({ label, value, mono }: FactProps) {
  return (
    <div className="bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2">
      <div className="label-mono text-[var(--text-muted)] text-[10px] mb-1">{label}</div>
      <div className={mono ? 'font-mono text-xs text-[var(--text-primary)] break-all' : 'text-xs text-[var(--text-primary)]'}>
        {value}
      </div>
    </div>
  );
}

function VmDiagnosticRow({ vm, orphan }: { vm: VmDiagnostic; orphan?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${
        orphan
          ? 'bg-[#facc150d] border border-[#facc1533]'
          : 'bg-[var(--bg-base)] border border-[var(--border-default)]'
      }`}
    >
      <span className="font-mono text-[var(--text-primary)] w-12 flex-shrink-0">{vm.vmid}</span>
      <span className="flex-1 min-w-0 text-[var(--text-primary)] truncate">{vm.name}</span>
      <span className="flex items-center gap-1 text-[var(--text-muted)]" title="Snapshot count">
        <Camera className="w-3 h-3" />
        {vm.has_baseline_snapshot ? (
          <span className="text-[var(--accent-green)]">baseline</span>
        ) : (
          <span className="text-[var(--accent-amber)]">none</span>
        )}
        <span>({vm.snapshot_count})</span>
      </span>
      {vm.tags.length > 0 && (
        <span className="hidden md:flex items-center gap-1 text-[var(--text-muted)]">
          <Tag className="w-3 h-3" />
          <span className="truncate max-w-[180px]">{vm.tags.join(', ')}</span>
        </span>
      )}
      <StatusBadge status={vm.proxmox_status} />
    </div>
  );
}
