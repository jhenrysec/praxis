import { ArrowLeft, Clock, Server, Cpu, HardDrive, ExternalLink } from 'lucide-react';
import { useScenario } from '@/hooks/useScenarios';
import { useSlots } from '@/hooks/useSlots';
import { useSlotVMs } from '@/hooks/useSlots';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useSlotStore } from '@/stores/slotStore';
import { useUIStore } from '@/stores/uiStore';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { DeployControls } from '@/components/DeployControls';
import { VMStatusRow } from '@/components/VMStatusRow';
import { NetworkTopology } from '@/components/NetworkTopology';
import { AccessSheet } from '@/components/AccessSheet';
import { SlotGrid } from '@/components/SlotGrid';

export function ScenarioDetail() {
  const { selectedScenario, selectScenario } = useScenarioStore();
  const { selectedSlot, selectSlot } = useSlotStore();
  const { setView } = useUIStore();
  const { data: scenario, isLoading } = useScenario(selectedScenario);
  const { data: slots } = useSlots();
  const { data: vms } = useSlotVMs(selectedSlot);

  const currentSlot = slots?.find((s) => s.slot_number === selectedSlot) ?? null;

  const handleBack = () => {
    selectScenario(null);
    setView('dashboard');
  };

  if (isLoading || !scenario) {
    return <div className="text-sm text-[#4b5563]">Loading scenario...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div>
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#e6edf3]">
              {scenario.display_name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8b949e]">
              {scenario.description}
            </p>
          </div>
          <DifficultyBadge difficulty={scenario.difficulty} />
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center gap-6 text-xs text-[#4b5563]">
          <span className="flex items-center gap-1"><Clock size={14} /> {scenario.estimated_hours}h</span>
          <span className="flex items-center gap-1"><Server size={14} /> {scenario.vm_count} VMs</span>
          <span className="flex items-center gap-1"><Cpu size={14} /> {scenario.total_cpu} cores</span>
          <span className="flex items-center gap-1"><HardDrive size={14} /> {Math.round(scenario.total_memory_mb / 1024)} GB RAM</span>
        </div>

        {/* ATT&CK techniques */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {scenario.mitre_techniques.map((tech) => (
            <a
              key={tech}
              href={`https://attack.mitre.org/techniques/${tech.replace('.', '/')}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded bg-[#a78bfa1a] px-2 py-0.5 text-[10px] font-medium text-[#a78bfa] hover:bg-[#a78bfa33] transition-colors"
            >
              {tech}
              <ExternalLink size={8} />
            </a>
          ))}
        </div>
      </div>

      {/* Deploy section */}
      <div className="rounded-lg border border-[#1e2228] bg-[#0d1017] p-5">
        <h2 className="font-heading mb-4 text-lg font-semibold text-[#e6edf3]">
          Deploy
        </h2>

        {/* Slot selector */}
        <div className="mb-4">
          <span className="label-mono mb-2 block text-[#4b5563]">SELECT SLOT</span>
          <SlotGrid
            slots={slots ?? []}
            selectedSlot={selectedSlot}
            onSelectSlot={selectSlot}
          />
        </div>

        {/* Controls */}
        {selectedSlot !== null && currentSlot && (
          <div className="mt-4 border-t border-[#1e2228] pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8b949e]">
                Slot {String(selectedSlot).padStart(2, '0')} — {currentSlot.status}
              </span>
              <DeployControls scenario={scenario} slot={currentSlot} />
            </div>
          </div>
        )}
      </div>

      {/* VM status + topology (only when slot is running) */}
      {currentSlot?.status === 'running' && vms && vms.length > 0 && (
        <>
          {/* Network topology */}
          <NetworkTopology vms={vms} scenarioName={scenario.display_name} />

          {/* VM list */}
          <div>
            <h2 className="font-heading mb-3 text-lg font-semibold text-[#e6edf3]">
              Virtual Machines
            </h2>
            <div className="space-y-2">
              {vms.map((vm) => (
                <VMStatusRow key={vm.vmid} vm={vm} />
              ))}
            </div>
          </div>

          {/* Access sheet */}
          <AccessSheet slot={currentSlot} />
        </>
      )}
    </div>
  );
}
