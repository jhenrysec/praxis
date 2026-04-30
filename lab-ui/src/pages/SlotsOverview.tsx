import { useState } from 'react';
import { useSlots, useSlotVMs, useSlotMutations } from '@/hooks/useSlots';
import { useScenarios } from '@/hooks/useScenarios';
import { useSlotStore } from '@/stores/slotStore';
import { useUIStore } from '@/stores/uiStore';
import { useTerminalStore } from '@/stores/terminalStore';
import { SlotGrid } from '@/components/SlotGrid';
import { VMStatusRow } from '@/components/VMStatusRow';
import { ScenarioControlPanel } from '@/components/ScenarioControlPanel';
import { DiagnosticsPanel } from '@/components/DiagnosticsPanel';
import { PerVmControls } from '@/components/PerVmControls';
import { ActiveScenariosModal } from '@/components/ActiveScenariosModal';

export function SlotsOverview() {
  const { data: slots, isLoading } = useSlots();
  const { data: scenarios } = useScenarios();
  const { selectedSlot, selectSlot } = useSlotStore();
  const { data: vms } = useSlotVMs(selectedSlot);
  const mutations = useSlotMutations();
  const { setTerminalOpen } = useUIStore();
  const { addLine, clear } = useTerminalStore();

  const [deployScenarioId, setDeployScenarioId] = useState<string>('');
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [showActiveModal, setShowActiveModal] = useState(false);

  const currentSlot = slots?.find((s) => s.slot_number === selectedSlot);

  if (isLoading) {
    return <div className="text-sm text-[var(--text-muted)]">Loading slots...</div>;
  }

  const activeSlots = (slots ?? []).filter(
    (s) =>
      s.slot_number !== currentSlot?.slot_number &&
      (s.status === 'running' || s.status === 'deploying'),
  );

  const log = (msg: string, type: 'stdout' | 'stderr' | 'system' = 'system') => addLine(msg, type);

  const runDeploy = () => {
    if (!currentSlot || !deployScenarioId) return;
    clear();
    setTerminalOpen(true);
    log(`Deploying ${deployScenarioId} to slot ${currentSlot.slot_number}...`);
    mutations.deploy.mutate(
      { slot: currentSlot.slot_number, scenarioId: deployScenarioId },
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

  const deployingScenarioName = currentSlot?.scenario_name
    ?? scenarios?.find((s) => s.name === deployScenarioId)?.display_name
    ?? deployScenarioId
    ?? 'scenario';

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-[var(--text-primary)]">
        Lab Slots
      </h1>

      <SlotGrid
        slots={slots ?? []}
        selectedSlot={selectedSlot}
        onSelectSlot={selectSlot}
      />

      {selectedSlot !== null && currentSlot && (
        <div className="space-y-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
              Slot {String(selectedSlot).padStart(2, '0')}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="label-mono text-[var(--text-muted)]">SCENARIO</span>
              <div className="mt-1 text-[var(--text-primary)]">
                {currentSlot.scenario_name ?? '—'}
              </div>
            </div>
            <div>
              <span className="label-mono text-[var(--text-muted)]">USER</span>
              <div className="mt-1 text-[var(--text-primary)]">
                {currentSlot.user ?? '—'}
              </div>
            </div>
            <div>
              <span className="label-mono text-[var(--text-muted)]">DEPLOYED</span>
              <div className="mt-1 text-[var(--text-primary)]">
                {currentSlot.deployed_at
                  ? new Date(currentSlot.deployed_at).toLocaleString()
                  : '—'}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-default)] pt-4">
            <ScenarioControlPanel
              slot={currentSlot}
              scenarios={scenarios ?? []}
              deployScenarioId={deployScenarioId}
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
          </div>

          {diagnosticsOpen && (
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-base)] p-4">
              <DiagnosticsPanel slot={currentSlot.slot_number} />
            </div>
          )}

          {vms && vms.length > 0 && (
            <div className="space-y-2">
              <span className="label-mono text-[var(--text-muted)]">VIRTUAL MACHINES</span>
              {vms.map((vm) => (
                <div key={vm.vmid} className="space-y-1.5">
                  <VMStatusRow vm={vm} />
                  <div className="pl-4">
                    <PerVmControls vm={vm} allowRollback compact />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showActiveModal && currentSlot && (
        <ActiveScenariosModal
          activeSlots={activeSlots}
          targetSlot={currentSlot.slot_number}
          scenarioName={deployingScenarioName}
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
