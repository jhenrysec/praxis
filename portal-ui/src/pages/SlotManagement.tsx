import { useState } from 'react';
import { useSlots, useSlotVMs, useSlotMutations, useScenarios } from '../hooks/useAdmin';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ActiveScenariosModal } from '../components/shared/ActiveScenariosModal';
import { ScenarioControlPanel } from '../components/shared/ScenarioControlPanel';
import { DiagnosticsPanel } from '../components/shared/DiagnosticsPanel';
import { PerVmControls } from '../components/shared/PerVmControls';
import {
  Monitor, ChevronRight, Cpu, MemoryStick, Clock, Layers,
} from 'lucide-react';
import type { LabSlot, Scenario, VMInfo } from '../types';

type PendingDeploy = {
  type: 'single';
  slot: number;
  scenarioId: string;
} | {
  type: 'all';
  scenarioId: string;
};

export function SlotManagement() {
  const { data: slotsData, isLoading } = useSlots();
  const { data: scenariosData } = useScenarios();
  const mutations = useSlotMutations();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [deployScenario, setDeployScenario] = useState('');
  const [showDeployAll, setShowDeployAll] = useState(false);
  const [deployAllScenario, setDeployAllScenario] = useState('');
  const [pendingDeploy, setPendingDeploy] = useState<PendingDeploy | null>(null);

  const slots = slotsData?.slots ?? [];
  const scenarios = scenariosData?.scenarios ?? [];
  const selected = slots.find((s) => s.slot_number === selectedSlot) ?? null;

  const activeSlots = slots.filter(
    (s) => s.status === 'running' || s.status === 'deploying',
  );

  const getScenarioName = (id: string) =>
    scenarios.find((s) => s.id === id)?.display_name ?? id;

  const handleDeploy = (slot: number) => {
    if (!deployScenario) return;

    const otherActive = activeSlots.filter((s) => s.slot_number !== slot);
    if (otherActive.length > 0) {
      setPendingDeploy({ type: 'single', slot, scenarioId: deployScenario });
    } else {
      mutations.deploy.mutate({ slot, scenarioId: deployScenario });
    }
  };

  const handleDeployAll = () => {
    if (!deployAllScenario) return;

    if (activeSlots.length > 0) {
      setPendingDeploy({ type: 'all', scenarioId: deployAllScenario });
      setShowDeployAll(false);
    } else {
      if (confirm(`Deploy "${deployAllScenario}" to ALL assigned empty slots?`)) {
        mutations.deployAll.mutate(deployAllScenario);
        setShowDeployAll(false);
        setDeployAllScenario('');
      }
    }
  };

  const handleDeployAnyway = () => {
    if (!pendingDeploy) return;

    if (pendingDeploy.type === 'single') {
      mutations.deploy.mutate({
        slot: pendingDeploy.slot,
        scenarioId: pendingDeploy.scenarioId,
      });
    } else {
      mutations.deployAll.mutate(pendingDeploy.scenarioId);
      setDeployAllScenario('');
    }
    setPendingDeploy(null);
  };

  const handleShutdownAndDeploy = async (slotsToDestroy: number[]) => {
    if (!pendingDeploy) return;
    const deploy = pendingDeploy;
    setPendingDeploy(null);

    for (const slotNum of slotsToDestroy) {
      try {
        await mutations.destroy.mutateAsync(slotNum);
      } catch {
        /* continue on failure */
      }
    }

    if (deploy.type === 'single') {
      mutations.deploy.mutate({
        slot: deploy.slot,
        scenarioId: deploy.scenarioId,
      });
    } else {
      mutations.deployAll.mutate(deploy.scenarioId);
      setDeployAllScenario('');
    }
  };

  const activeModalTarget =
    pendingDeploy?.type === 'single' ? pendingDeploy.slot : 'all' as const;

  const activeModalSlots = pendingDeploy?.type === 'single'
    ? activeSlots.filter((s) => s.slot_number !== pendingDeploy.slot)
    : activeSlots;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Lab Slots</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {slots.filter((s) => s.status === 'running').length} running / {slots.length} total
          </p>
        </div>
        <button
          onClick={() => setShowDeployAll(true)}
          className="flex items-center gap-2 bg-[var(--accent-blue)] text-[var(--bg-base)] px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          <Layers className="w-4 h-4" /> Deploy All
        </button>
      </div>

      {/* Deploy-all modal */}
      {showDeployAll && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Deploy to All Slots</h2>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              Deploy the selected scenario to all user-assigned empty slots.
            </p>
            <select
              value={deployAllScenario}
              onChange={(e) => setDeployAllScenario(e.target.value)}
              className="w-full bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm mb-4"
              aria-label="Select scenario for deploy-all"
            >
              <option value="">Select scenario...</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>{s.display_name}</option>
              ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeployAll(false); setDeployAllScenario(''); }}
                className="flex-1 bg-[var(--bg-base)] border border-[var(--border-default)] rounded-lg py-2 text-sm hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeployAll}
                disabled={!deployAllScenario || mutations.deployAll.isPending}
                className="flex-1 bg-[var(--accent-blue)] text-[var(--bg-base)] rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {mutations.deployAll.isPending ? 'Deploying...' : 'Deploy All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDeploy && activeModalSlots.length > 0 && (
        <ActiveScenariosModal
          activeSlots={activeModalSlots}
          targetSlot={activeModalTarget}
          scenarioName={getScenarioName(pendingDeploy.scenarioId)}
          onDeployAnyway={handleDeployAnyway}
          onShutdownAndDeploy={handleShutdownAndDeploy}
          onCancel={() => setPendingDeploy(null)}
        />
      )}

      <div className="grid grid-cols-[1fr_1fr] gap-6">
        {/* Slot Grid */}
        <div>
          <h2 className="label-mono text-[var(--text-muted)] mb-3">SLOT GRID</h2>
          {isLoading ? (
            <div className="text-[var(--text-muted)] text-sm">Loading slots...</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.slot_number}
                  onClick={() => setSelectedSlot(slot.slot_number)}
                  className={`relative p-3 rounded-lg border text-left transition-all ${
                    selectedSlot === slot.slot_number
                      ? 'border-[var(--accent-green)] bg-[#00e5a00d]'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)] hover:border-[var(--border-active)]'
                  }`}
                  aria-label={`Slot ${slot.slot_number}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="label-mono text-[var(--text-primary)]">#{slot.slot_number}</span>
                    <SlotStatusDot status={slot.status} />
                  </div>
                  <div className="text-xs text-[var(--text-muted)] truncate">
                    {slot.scenario_id ?? 'empty'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Slot Detail */}
        <div>
          <h2 className="label-mono text-[var(--text-muted)] mb-3">SLOT DETAIL</h2>
          {selected ? (
            <SlotDetail
              slot={selected}
              scenarios={scenarios}
              deployScenario={deployScenario}
              onDeployScenarioChange={setDeployScenario}
              onDeploy={() => handleDeploy(selected.slot_number)}
              mutations={mutations}
            />
          ) : (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-8 text-center text-[var(--text-muted)] text-sm">
              Select a slot to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlotStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: '#00e5a0',
    stopped: '#6c8fff',
    deploying: '#facc15',
    starting: '#facc15',
    stopping: '#facc15',
    configuring: '#a78bfa',
    resetting: '#a78bfa',
    destroying: '#fb7185',
    error: '#fb7185',
    empty: '#4b5563',
  };
  const color = colors[status] ?? '#4b5563';
  const pulse =
    status === 'running' ||
    status === 'deploying' ||
    status === 'destroying' ||
    status === 'starting' ||
    status === 'stopping' ||
    status === 'configuring' ||
    status === 'resetting';

  return (
    <span
      className={`w-2 h-2 rounded-full inline-block ${pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: color }}
      title={status}
    />
  );
}

interface SlotDetailProps {
  slot: LabSlot;
  scenarios: Scenario[];
  deployScenario: string;
  onDeployScenarioChange: (v: string) => void;
  onDeploy: () => void;
  mutations: ReturnType<typeof useSlotMutations>;
}

function SlotDetail({ slot, scenarios, deployScenario, onDeployScenarioChange, onDeploy, mutations }: SlotDetailProps) {
  const { data: vmData } = useSlotVMs(slot.slot_number);
  const vms = vmData?.vms ?? [];
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">Slot #{slot.slot_number}</span>
        </div>
      </div>

      {/* Info */}
      <div className="px-4 py-3 border-b border-[var(--border-default)] grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-[var(--text-muted)]">Scenario:</span>{' '}
          <span className="text-[var(--text-primary)]">{slot.scenario_id ?? '—'}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">User:</span>{' '}
          <span className="text-[var(--text-primary)]">{slot.user_id ?? '—'}</span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Deployed:</span>{' '}
          <span className="text-[var(--text-primary)]">
            {slot.deployed_at ? new Date(slot.deployed_at).toLocaleString() : '—'}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Last Reset:</span>{' '}
          <span className="text-[var(--text-primary)]">
            {slot.last_reset ? new Date(slot.last_reset).toLocaleString() : '—'}
          </span>
        </div>
      </div>

      {/* Control Panel */}
      <div className="px-4 py-3 border-b border-[var(--border-default)]">
        <ScenarioControlPanel
          slot={slot}
          scenarios={scenarios}
          deployScenarioId={deployScenario}
          onDeployScenarioChange={onDeployScenarioChange}
          onDeploy={onDeploy}
          onShutdown={() => mutations.shutdown.mutate(slot.slot_number)}
          onStart={() => mutations.start.mutate(slot.slot_number)}
          onReset={() => mutations.reset.mutate(slot.slot_number)}
          onDestroy={() => mutations.destroy.mutate(slot.slot_number)}
          onForceDestroy={() => mutations.forceDestroy.mutate(slot.slot_number)}
          onToggleDiagnostics={() => setShowDiagnostics((v) => !v)}
          diagnosticsOpen={showDiagnostics}
          mutations={{
            deploy: mutations.deploy,
            shutdown: mutations.shutdown,
            start: mutations.start,
            reset: mutations.reset,
            destroy: mutations.destroy,
            forceDestroy: mutations.forceDestroy,
          }}
        />
      </div>

      {/* Diagnostics */}
      {showDiagnostics && (
        <div className="px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-base)]">
          <DiagnosticsPanel slot={slot.slot_number} />
        </div>
      )}

      {/* VMs */}
      <div className="px-4 py-3">
        <h3 className="label-mono text-[var(--text-muted)] mb-2">VIRTUAL MACHINES</h3>
        {vms.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No VMs in this slot</p>
        ) : (
          <div className="space-y-2">
            {vms.map((vm) => (
              <VMRow key={vm.vmid} vm={vm} />
            ))}
          </div>
        )}
      </div>

      {/* Deploy log */}
      {slot.deploy_log && (
        <div className="px-4 py-3 border-t border-[var(--border-default)]">
          <h3 className="label-mono text-[var(--text-muted)] mb-2">DEPLOY LOG</h3>
          <pre className="text-xs text-[var(--text-secondary)] bg-[var(--bg-base)] rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
            {slot.deploy_log}
          </pre>
        </div>
      )}
    </div>
  );
}

function VMRow({ vm }: { vm: VMInfo }) {
  const memPercent = vm.maxmem > 0 ? Math.round((vm.mem / vm.maxmem) * 100) : 0;
  const uptimeStr = formatUptime(vm.uptime);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--bg-base)] rounded-lg">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
        aria-label={`Toggle ${vm.name} controls`}
      >
        <Monitor className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--text-primary)] truncate">{vm.name}</span>
            <StatusBadge status={vm.status} />
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" /> {vm.cpu.toFixed(0)}%
            </span>
            <span className="flex items-center gap-1">
              <MemoryStick className="w-3 h-3" /> {memPercent}%
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {uptimeStr}
            </span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-1 border-t border-[var(--border-default)]">
          <PerVmControls vm={vm} />
        </div>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
