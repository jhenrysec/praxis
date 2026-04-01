import { useState } from 'react';
import { Play, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import type { Scenario, LabSlot } from '@/types';
import { deployScenario, destroySlot, resetSlot, connectDeployStream } from '@/api/client';
import { useTerminalStore } from '@/stores/terminalStore';
import { useSlotStore } from '@/stores/slotStore';
import { useUIStore } from '@/stores/uiStore';

interface DeployControlsProps {
  scenario: Scenario;
  slot: LabSlot;
}

export function DeployControls({ scenario, slot }: DeployControlsProps) {
  const [loading, setLoading] = useState<'deploy' | 'destroy' | 'reset' | null>(null);
  const { addLine, clear, setStreaming } = useTerminalStore();
  const { updateSlotStatus } = useSlotStore();
  const { setTerminalOpen } = useUIStore();

  const handleDeploy = async () => {
    if (slot.status !== 'empty') return;
    setLoading('deploy');
    clear();
    setTerminalOpen(true);
    setStreaming(true, slot.slot_number);
    addLine(`Deploying ${scenario.display_name} to slot ${slot.slot_number}...`, 'system');
    updateSlotStatus(slot.slot_number, 'deploying');

    try {
      const res = await deployScenario({
        scenario_id: scenario.name,
        slot_number: slot.slot_number,
      });

      if (res.status === 'started') {
        addLine('Deploy job started. Streaming Terraform output...', 'system');
        const ws = connectDeployStream(
          slot.slot_number,
          (data) => addLine(data),
          () => {
            setStreaming(false);
            addLine('Deploy stream closed.', 'system');
            setLoading(null);
          },
        );

        // Clean up if component unmounts
        return () => ws.close();
      } else {
        addLine(`Deploy failed: ${res.message}`, 'stderr');
        updateSlotStatus(slot.slot_number, 'error');
      }
    } catch (err) {
      addLine(`Error: ${err instanceof Error ? err.message : String(err)}`, 'stderr');
      updateSlotStatus(slot.slot_number, 'error');
    }
    setLoading(null);
  };

  const handleDestroy = async () => {
    if (slot.status === 'empty') return;
    const confirmed = window.confirm(
      `Destroy all VMs in slot ${slot.slot_number}? This cannot be undone.`,
    );
    if (!confirmed) return;

    setLoading('destroy');
    clear();
    setTerminalOpen(true);
    setStreaming(true, slot.slot_number);
    addLine(`Destroying slot ${slot.slot_number}...`, 'system');
    updateSlotStatus(slot.slot_number, 'destroying');

    try {
      const res = await destroySlot(slot.slot_number);
      if (res.status === 'started') {
        addLine('Destroy job started.', 'system');
        connectDeployStream(
          slot.slot_number,
          (data) => addLine(data),
          () => {
            setStreaming(false);
            addLine('Destroy complete.', 'system');
            updateSlotStatus(slot.slot_number, 'empty');
            setLoading(null);
          },
        );
      } else {
        addLine(`Destroy failed: ${res.message}`, 'stderr');
      }
    } catch (err) {
      addLine(`Error: ${err instanceof Error ? err.message : String(err)}`, 'stderr');
    }
    setLoading(null);
  };

  const handleReset = async () => {
    if (slot.status !== 'running') return;
    const confirmed = window.confirm(
      `Reset slot ${slot.slot_number} to baseline snapshot?`,
    );
    if (!confirmed) return;

    setLoading('reset');
    addLine(`Resetting slot ${slot.slot_number} to baseline...`, 'system');

    try {
      const res = await resetSlot(slot.slot_number);
      addLine(res.message, res.status === 'started' ? 'system' : 'stderr');
    } catch (err) {
      addLine(`Error: ${err instanceof Error ? err.message : String(err)}`, 'stderr');
    }
    setLoading(null);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Deploy */}
      <button
        onClick={handleDeploy}
        disabled={slot.status !== 'empty' || loading !== null}
        className="flex items-center gap-1.5 rounded-md border border-[#00e5a033] bg-[#00e5a00d] px-3 py-1.5 text-xs font-medium text-[#00e5a0] transition-all hover:bg-[#00e5a01a] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Deploy scenario"
      >
        {loading === 'deploy' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
        DEPLOY
      </button>

      {/* Reset */}
      <button
        onClick={handleReset}
        disabled={slot.status !== 'running' || loading !== null}
        className="flex items-center gap-1.5 rounded-md border border-[#facc1533] bg-[#facc150d] px-3 py-1.5 text-xs font-medium text-[#facc15] transition-all hover:bg-[#facc151a] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Reset to baseline"
      >
        {loading === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
        RESET
      </button>

      {/* Destroy */}
      <button
        onClick={handleDestroy}
        disabled={slot.status === 'empty' || loading !== null}
        className="flex items-center gap-1.5 rounded-md border border-[#fb718533] bg-[#fb71850d] px-3 py-1.5 text-xs font-medium text-[#fb7185] transition-all hover:bg-[#fb71851a] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Destroy scenario"
      >
        {loading === 'destroy' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        DESTROY
      </button>
    </div>
  );
}
