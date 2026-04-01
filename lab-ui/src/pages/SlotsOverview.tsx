import { useSlots } from '@/hooks/useSlots';
import { useSlotVMs } from '@/hooks/useSlots';
import { useSlotStore } from '@/stores/slotStore';
import { SlotGrid } from '@/components/SlotGrid';
import { VMStatusRow } from '@/components/VMStatusRow';
import { StatusBadge } from '@/components/StatusBadge';

export function SlotsOverview() {
  const { data: slots, isLoading } = useSlots();
  const { selectedSlot, selectSlot } = useSlotStore();
  const { data: vms } = useSlotVMs(selectedSlot);

  const currentSlot = slots?.find((s) => s.slot_number === selectedSlot);

  if (isLoading) {
    return <div className="text-sm text-[#4b5563]">Loading slots...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-[#e6edf3]">
        Lab Slots
      </h1>

      {/* Grid */}
      <SlotGrid
        slots={slots ?? []}
        selectedSlot={selectedSlot}
        onSelectSlot={selectSlot}
      />

      {/* Selected slot detail */}
      {selectedSlot !== null && currentSlot && (
        <div className="rounded-lg border border-[#1e2228] bg-[#0d1017] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-[#e6edf3]">
              Slot {String(selectedSlot).padStart(2, '0')}
            </h2>
            <StatusBadge status={currentSlot.status} />
          </div>

          <div className="mb-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="label-mono text-[#4b5563]">SCENARIO</span>
              <div className="mt-1 text-[#e6edf3]">
                {currentSlot.scenario_name ?? '—'}
              </div>
            </div>
            <div>
              <span className="label-mono text-[#4b5563]">USER</span>
              <div className="mt-1 text-[#e6edf3]">
                {currentSlot.user ?? '—'}
              </div>
            </div>
            <div>
              <span className="label-mono text-[#4b5563]">DEPLOYED</span>
              <div className="mt-1 text-[#e6edf3]">
                {currentSlot.deployed_at
                  ? new Date(currentSlot.deployed_at).toLocaleString()
                  : '—'}
              </div>
            </div>
          </div>

          {/* VMs */}
          {vms && vms.length > 0 && (
            <div className="space-y-2">
              <span className="label-mono text-[#4b5563]">VIRTUAL MACHINES</span>
              {vms.map((vm) => (
                <VMStatusRow key={vm.vmid} vm={vm} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
