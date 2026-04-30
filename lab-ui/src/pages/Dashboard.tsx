import { Shield, Server, Activity, AlertTriangle } from 'lucide-react';
import { useScenarios } from '@/hooks/useScenarios';
import { useSlots } from '@/hooks/useSlots';
import { ScenarioCard } from '@/components/ScenarioCard';
import { SlotGrid } from '@/components/SlotGrid';
import { useScenarioStore } from '@/stores/scenarioStore';
import { useSlotStore } from '@/stores/slotStore';
import { useUIStore } from '@/stores/uiStore';

export function Dashboard() {
  const { data: scenarios, isLoading: scenariosLoading } = useScenarios();
  const { data: slots, isLoading: slotsLoading } = useSlots();
  const { selectScenario } = useScenarioStore();
  const { selectedSlot, selectSlot } = useSlotStore();
  const { setView } = useUIStore();

  const handleSelectScenario = (name: string) => {
    selectScenario(name);
    setView('scenario');
  };

  const activeSlots = slots?.filter((s) => s.status === 'running').length ?? 0;
  const totalVMs = slots?.reduce((sum, s) => sum + (s.vms?.length ?? 0), 0) ?? 0;
  const errorSlots = slots?.filter((s) => s.status === 'error').length ?? 0;

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'SCENARIOS', value: scenarios?.length ?? 0, icon: Shield, color: '#00e5a0' },
          { label: 'ACTIVE SLOTS', value: activeSlots, icon: Server, color: '#6c8fff' },
          { label: 'RUNNING VMS', value: totalVMs, icon: Activity, color: '#a78bfa' },
          { label: 'ERRORS', value: errorSlots, icon: AlertTriangle, color: errorSlots > 0 ? '#fb7185' : '#4b5563' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#1e2228] bg-[#0d1017] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="label-mono text-[#4b5563]">{stat.label}</span>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div
              className="font-heading mt-2 text-3xl font-bold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Slot grid */}
      <section>
        <h2 className="font-heading mb-4 text-xl font-semibold text-[#e6edf3]">
          Lab Slots
        </h2>
        {slotsLoading ? (
          <div className="text-sm text-[#4b5563]">Loading slots...</div>
        ) : (
          <SlotGrid
            slots={slots ?? []}
            selectedSlot={selectedSlot}
            onSelectSlot={selectSlot}
          />
        )}
      </section>

      {/* Scenario catalog */}
      <section>
        <h2 className="font-heading mb-4 text-xl font-semibold text-[#e6edf3]">
          Scenario Catalog
        </h2>
        {scenariosLoading ? (
          <div className="text-sm text-[#4b5563]">Loading scenarios...</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {scenarios?.map((scenario) => (
              <ScenarioCard
                key={scenario.name}
                scenario={scenario}
                onSelect={handleSelectScenario}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
