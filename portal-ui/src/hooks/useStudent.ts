import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuthStore } from '../stores/authStore';

// ── Slot ──────────────────────────────────────────────────────────────

export function useMySlot() {
  const { user } = useAuthStore();
  const slot = user?.lab_slot ?? null;

  return useQuery({
    queryKey: ['mySlot', slot],
    queryFn: () => apiClient.getSlot(slot!),
    enabled: slot !== null,
    refetchInterval: 10_000,
  });
}

export function useMyVMs() {
  return useQuery({
    queryKey: ['myVMs'],
    queryFn: () => apiClient.getConsoleVMs(),
    refetchInterval: 10_000,
  });
}

export function useMySlotVMs() {
  const { user } = useAuthStore();
  const slot = user?.lab_slot ?? null;

  return useQuery({
    queryKey: ['mySlotVMs', slot],
    queryFn: () => apiClient.getSlotVMs(slot!),
    enabled: slot !== null,
    refetchInterval: 10_000,
  });
}

// ── Objectives ────────────────────────────────────────────────────────

export function useMyObjectives() {
  return useQuery({
    queryKey: ['myObjectives'],
    queryFn: () => apiClient.getObjectives(),
    refetchInterval: 30_000,
  });
}

export function useCompleteObjective() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ objectiveN, slotNumber, scenarioId }: { objectiveN: number; slotNumber?: number; scenarioId?: string }) =>
      apiClient.completeObjective(objectiveN, slotNumber, scenarioId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['myObjectives'] }); },
  });
}

// ── Hints ─────────────────────────────────────────────────────────────

export function useMyHints() {
  return useQuery({
    queryKey: ['myHints'],
    queryFn: () => apiClient.getHints(),
    refetchInterval: 15_000,
  });
}

export function useMarkHintRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hintId: string) => apiClient.markHintRead(hintId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['myHints'] }); },
  });
}

// ── Scenario Detail ───────────────────────────────────────────────────

export function useScenarioDetail(scenarioId: string | null | undefined) {
  return useQuery({
    queryKey: ['scenario', scenarioId],
    queryFn: () => apiClient.getScenario(scenarioId!),
    enabled: !!scenarioId,
    staleTime: 60_000,
  });
}
