import { useState } from 'react';
import { ArrowLeft, Clock, Server, Cpu, HardDrive, ExternalLink } from 'lucide-react';
import { useScenario, useScenarios } from '@/hooks/useScenarios';
import { useSlots, useSlotVMs, useSlotMutations } from '@/hooks/useSlots';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useSlotStore } from '@/stores/slotStore';
import { useUIStore } from '@/stores/uiStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { ScenarioControlPanel } from '@/components/ScenarioControlPanel';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { PerVmControls } from '@/components/PerVmControls';
import { VMStatusRow } from '@/components/VMStatusRow';
import { NetworkTopology } from '@/components/NetworkTopology';
import { AccessSheet } from '@/components/AccessSheet';
import { SlotGrid } from '@/components/SlotGrid';
import { ActiveScenariosModal } from '@/components/ActiveScenariosModal';

export function ScenarioDetail() {
  const { selectedScenario, selectScenario } = useScenarioStore();
  const { selectedSlot, selectSlot } = useSlotStore();
  const { setView, setTerminalOpen } = useUIStore();
  const { addLine, clear } = useTerminalStore();

  const { data: scenario, isLoading } = useScenario(selectedScenario);
  const { data: scenarios } = useScenarios();
  const { data: slots } = useSlots();
  const { data: vms } = useSlotVMs(selectedSlot);
  const mutations = useSlotMutations();

  const [deployScenarioId, setDeployScenarioId] = useState<string>('');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);

  const currentSlot = slots?.find((s) => s.slot_number === selectedSlot) ?? null;

  if (isLoading || !scenario) {
    return <div className="text-sm text-[var(--text-muted)]">Loading scenario...</div>;
  }

  const activeSlots = (slots ?? []).filter(
    (s) =>
      s.slot_number !== currentSlot?.slot_number &&
      (s.status === 'running' || s.status === 'deploying'),
  );

  const log = (msg: string, type: 'stdout' | 'stderr' | 'system' = 'system') => addLine(msg, type);

  const runDeploy = () => {
    if (!currentSlot) return;
    const scenarioId = deployScenarioId || scenario.name;
    clear();
    setTerminalOpen(true);
    log(`Deploying ${scenarioId} to slot ${currentSlot.slot_number}...`);
    mutations.deploy.mutate(
      { slot: currentSlot.slot_number, scenarioId },
      {
        onSuccess: () => log('Deploy job accepted. Tracking status...'),
        onError: (err) => log(`Deploy failed: ${err instanceof Error ? err.message : String(err)}`, 'stderr'),
      },
    );
  };

  const handleDeploy = () => {
    if (!currentSlot) return;
    if (activeSlots.length > 0) {
      setShowActiveModal(true);
    } else {
      runDeploy();
    }
  };

  const handleShutdownAndDeploy = async (slotsToDestroy: number[]) => {
    setShowActiveModal(false);
    clear();
    setTerminalOpen(true);
    log(`Shutting down ${slotsToDestroy.length} slot${slotsToDestroy.length !== 1 ? 's' : ''} before deploy...`);
    for (const slotNum of slotsToDestroy) {
      log(`  Destroying slot ${String(slotNum).padStart(2, '0')}...`);
      try {
        await mutations.destroy.mutateAsync(slotNum);
        log(`  Slot ${String(slotNum).padStart(2, '0')} destroy accepted.`);
      } catch (err) {
        log(`  Failed to destroy slot ${slotNum}: ${err instanceof Error ? err.message : String(err)}`, 'stderr');
      }
    }
    log('Shutdown sequence complete. Starting deploy...');
    runDeploy();
  };

  const simpleAction = (label: string, fire: () => void) => {
    if (!currentSlot) return;
    setTerminalOpen(true);
    log(`${label} slot ${currentSlot.slot_number}...`);
    fire();
  };

  return (
    <div className="space-y-6">
      <div>
        <button
          onClick={() => {
            selectScenario(null);
            setView('dashboard');
          }}
          className="mb-4 flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">
              {scenario.display_name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              {scenario.description}
            </p>
          </div>
          <DifficultyBadge difficulty={scenario.difficulty} />
        </div>

        <div className="mt-4 flex items-center gap-6 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><Clock size={14} /> {scenario.estimated_hours}h</span>
          <span className="flex items-center gap-1"><Server size={14} /> {scenario.vm_count} VMs</span>
          <span className="flex items-center gap-1"><Cpu size={14} /> {scenario.total_cpu} cores</span>
          <span className="flex items-center gap-1"><HardDrive size={14} /> {Math.round(scenario.total_memory_mb / 1024)} GB RAM</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {scenario.mitre_techniques.map((tech) => (
            <a
              key={tech}
              href={`https://attack.mitre.org/techniques/${tech.replace('.', '/')}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-[#a78bfa1a] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-purple)] hover:bg-[#a78bfa33] transition-colors"
            >
              {tech}
              <ExternalLink size={8} />
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="font-heading mb-4 text-lg font-semibold text-[var(--text-primary)]">
          Lifecycle
        </h2>

        <div className="mb-4">
          <span className="label-mono mb-2 block text-[var(--text-muted)]">SELECT SLOT</span>
          <SlotGrid
            slots={slots ?? []}
            selectedSlot={selectedSlot}
            onSelectSlot={selectSlot}
          />
        </div>

        {selectedSlot !== null && currentSlot && (
          <div className="mt-4 border-t border-[var(--border-default)] pt-4">
            <ScenarioControlPanel
              slot={currentSlot}
              scenarios={scenarios ?? []}
              deployScenarioId={deployScenarioId || scenario.name}
              onDeployScenarioChange={setDeployScenarioId}
              onDeploy={handleDeploy}
              onShutdown={() => simpleAction('Shutting down', () => mutations.shutdown.mutate(currentSlot.slot_number))}
              onStart={() => simpleAction('Starting', () => mutations.start.mutate(currentSlot.slot_number))}
              onReset={() => simpleAction('Resetting', () => mutations.reset.mutate(currentSlot.slot_number))}
              onDestroy={() => simpleAction('Destroying', () => mutations.destroy.mutate(currentSlot.slot_number))}
              onForceDestroy={() => simpleAction('Force-destroying', () => mutations.forceDestroy.mutate(currentSlot.slot_number))}
              onToggleDiagnostics={() => setDiagnosticsOpen((v) => !v)}
              diagnosticsOpen={diagnosticsOpen}
              mutations={mutations}
            />

            {diagnosticsOpen && (
              <div className="mt-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
                <DiagnosticsPanel slot={currentSlot.slot_number} />
              </div>
            )}
          </div>
        )}
      </div>

      {currentSlot && vms && vms.length > 0 && (
        <>
          {currentSlot.status === 'running' && (
            <NetworkTopology vms={vms} scenarioName={scenario.display_name} />
          )}

          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[var(--text-primary)]">
              Virtual Machines
            </h2>
            <div className="space-y-2">
              {vms.map((vm) => (
                <div key={vm.vmid} className="space-y-1.5">
                  <VMStatusRow vm={vm} />
                  <div className="pl-4">
                    <PerVmControls vm={vm} allowRollback compact />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {currentSlot.status === 'running' && <AccessSheet slot={currentSlot} />}
        </>
      )}

      {showActiveModal && currentSlot && (
        <ActiveScenariosModal
          activeSlots={activeSlots}
          targetSlot={currentSlot.slot_number}
          scenarioName={scenario.display_name}
          onDeployAnyway={() => {
            setShowActiveModal(false);
            runDeploy();
          }}
          onShutdownAndDeploy={handleShutdownAndDeploy}
          onCancel={() => setShowActiveModal(false)}
        />
      )}
    </div>
  );
}
