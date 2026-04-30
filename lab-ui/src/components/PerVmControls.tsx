import { useState } from 'react';
import { Power, PowerOff, Square, RefreshCw, History, Loader2, AlertTriangle } from 'lucide-react';
import { useVMMutations } from '@/hooks/useSlots';
import type { VMStatus } from '@/types';

interface PerVmControlsProps {
  vm: VMStatus;
  allowRollback?: boolean;
  compact?: boolean;
}

export function PerVmControls({ vm, allowRollback = true, compact = false }: PerVmControlsProps) {
  const mutations = useVMMutations();
  const [confirm, setConfirm] = useState<null | 'stop' | 'rollback'>(null);

  const isRunning = vm.status === 'running';
  const isStopped = vm.status === 'stopped';
  const anyPending =
    mutations.start.isPending ||
    mutations.shutdown.isPending ||
    mutations.stop.isPending ||
    mutations.reboot.isPending ||
    mutations.rollback.isPending;

  const btnBase = compact
    ? 'flex items-center gap-1 px-2 py-1 rounded border text-[11px]'
    : 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs';
  const iconSize = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  const run = (action: () => void, needsConfirm: 'stop' | 'rollback' | null = null) => {
    if (needsConfirm && confirm !== needsConfirm) {
      setConfirm(needsConfirm);
      return;
    }
    action();
    setConfirm(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {isStopped && (
        <button
          onClick={() => mutations.start.mutate(vm.vmid)}
          disabled={anyPending}
          className={`${btnBase} bg-[#00e5a01a] border-[#00e5a033] text-[var(--accent-green)] hover:bg-[#00e5a02a] disabled:opacity-40`}
          aria-label="Start VM"
          title="Start"
        >
          {mutations.start.isPending ? <Loader2 className={`${iconSize} animate-spin`} /> : <Power className={iconSize} />}
          {!compact && 'Start'}
        </button>
      )}

      {isRunning && (
        <>
          <button
            onClick={() => mutations.shutdown.mutate(vm.vmid)}
            disabled={anyPending}
            className={`${btnBase} bg-[#6c8fff1a] border-[#6c8fff33] text-[var(--accent-blue)] hover:bg-[#6c8fff2a] disabled:opacity-40`}
            aria-label="Shutdown VM"
            title="Graceful shutdown"
          >
            {mutations.shutdown.isPending ? <Loader2 className={`${iconSize} animate-spin`} /> : <PowerOff className={iconSize} />}
            {!compact && 'Shutdown'}
          </button>
          <button
            onClick={() => mutations.reboot.mutate(vm.vmid)}
            disabled={anyPending}
            className={`${btnBase} bg-[var(--bg-base)] border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40`}
            aria-label="Reboot VM"
            title="Reboot"
          >
            {mutations.reboot.isPending ? <Loader2 className={`${iconSize} animate-spin`} /> : <RefreshCw className={iconSize} />}
            {!compact && 'Reboot'}
          </button>
          {confirm === 'stop' ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => run(() => mutations.stop.mutate(vm.vmid), null)}
                disabled={anyPending}
                className={`${btnBase} bg-[#fb71851a] border-[#fb718533] text-[var(--accent-red)] hover:bg-[#fb71852a] disabled:opacity-40`}
                aria-label="Confirm force stop"
              >
                {mutations.stop.isPending ? <Loader2 className={`${iconSize} animate-spin`} /> : <AlertTriangle className={iconSize} />}
                Confirm stop
              </button>
              <button
                onClick={() => setConfirm(null)}
                className="px-1.5 py-1 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
                aria-label="Cancel stop"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => run(() => mutations.stop.mutate(vm.vmid), 'stop')}
              disabled={anyPending}
              className={`${btnBase} bg-[#fb71851a] border-[#fb718533] text-[var(--accent-red)] hover:bg-[#fb71852a] disabled:opacity-40`}
              aria-label="Force stop VM"
              title="Force stop (no graceful shutdown)"
            >
              <Square className={iconSize} />
              {!compact && 'Stop'}
            </button>
          )}
        </>
      )}

      {allowRollback && (
        confirm === 'rollback' ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => run(() => mutations.rollback.mutate(vm.vmid), null)}
              disabled={anyPending}
              className={`${btnBase} bg-[#a78bfa1a] border-[#a78bfa33] text-[var(--accent-purple)] hover:bg-[#a78bfa2a] disabled:opacity-40`}
              aria-label="Confirm rollback"
            >
              {mutations.rollback.isPending ? <Loader2 className={`${iconSize} animate-spin`} /> : <History className={iconSize} />}
              Confirm rollback
            </button>
            <button
              onClick={() => setConfirm(null)}
              className="px-1.5 py-1 rounded text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              aria-label="Cancel rollback"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => run(() => mutations.rollback.mutate(vm.vmid), 'rollback')}
            disabled={anyPending}
            className={`${btnBase} bg-[#a78bfa1a] border-[#a78bfa33] text-[var(--accent-purple)] hover:bg-[#a78bfa2a] disabled:opacity-40`}
            aria-label="Rollback VM to baseline"
            title="Rollback to baseline snapshot"
          >
            <History className={iconSize} />
            {!compact && 'Rollback'}
          </button>
        )
      )}

      {!isRunning && !isStopped && (
        <span className="text-[10px] text-[var(--text-muted)] italic">
          status: {vm.status}
        </span>
      )}
    </div>
  );
}
