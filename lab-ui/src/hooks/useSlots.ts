import { useQuery } from '@tanstack/react-query';
import { fetchSlots, fetchSlotVMs } from '@/api/client';
import type { LabSlot, VMStatus } from '@/types';

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
