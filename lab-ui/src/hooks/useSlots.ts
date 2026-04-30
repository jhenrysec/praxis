import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSlots, fetchSlotVMs, fetchSlotDiagnostics,
  deployScenario, destroySlot, resetSlot, shutdownSlot, startSlot, forceDestroySlot,
  startVM, shutdownVM, stopVM, rebootVM, rollbackVM,
} from '@/api/client';
import type { LabSlot, VMStatus, SlotDiagnostics } from '@/types';

export function useSlots() {
  return useQuery<LabSlot[]>({
    queryKey: ['slots'],
    queryFn: fetchSlots,
    refetchInterval: 10_000,
  });
}

export function useSlotVMs(slot: number | null) {
  return useQuery<VMStatus[]>({
    queryKey: ['slot-vms', slot],
    queryFn: () => fetchSlotVMs(slot!),
    enabled: slot !== null,
    refetchInterval: 5_000,
  });
}

export function useSlotDiagnostics(slot: number | null, enabled = true) {
  return useQuery<SlotDiagnostics>({
    queryKey: ['slot-diagnostics', slot],
    queryFn: () => fetchSlotDiagnostics(slot!),
    enabled: enabled && slot !== null,
    refetchInterval: 15_000,
  });
}

export function useSlotMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['slots'] });
    void qc.invalidateQueries({ queryKey: ['slot-vms'] });
    void qc.invalidateQueries({ queryKey: ['slot-diagnostics'] });
  };

  const deploy = useMutation({
    mutationFn: ({ slot, scenarioId }: { slot: number; scenarioId: string }) =>
      deployScenario({ slot_number: slot, scenario_id: scenarioId }),
    onSuccess: invalidate,
  });
  const destroy = useMutation({ mutationFn: (slot: number) => destroySlot(slot), onSuccess: invalidate });
  const reset = useMutation({ mutationFn: (slot: number) => resetSlot(slot), onSuccess: invalidate });
  const shutdown = useMutation({ mutationFn: (slot: number) => shutdownSlot(slot), onSuccess: invalidate });
  const start = useMutation({ mutationFn: (slot: number) => startSlot(slot), onSuccess: invalidate });
  const forceDestroy = useMutation({ mutationFn: (slot: number) => forceDestroySlot(slot), onSuccess: invalidate });

  return { deploy, destroy, reset, shutdown, start, forceDestroy };
}

export function useVMMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['slot-vms'] });
    void qc.invalidateQueries({ queryKey: ['slot-diagnostics'] });
  };

  const start = useMutation({ mutationFn: (vmId: number) => startVM(vmId), onSuccess: invalidate });
  const shutdown = useMutation({ mutationFn: (vmId: number) => shutdownVM(vmId), onSuccess: invalidate });
  const stop = useMutation({ mutationFn: (vmId: number) => stopVM(vmId), onSuccess: invalidate });
  const reboot = useMutation({ mutationFn: (vmId: number) => rebootVM(vmId), onSuccess: invalidate });
  const rollback = useMutation({ mutationFn: (vmId: number) => rollbackVM(vmId), onSuccess: invalidate });

  return { start, shutdown, stop, reboot, rollback };
}
