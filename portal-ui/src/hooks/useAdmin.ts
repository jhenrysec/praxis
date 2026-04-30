import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

// ── Users ──────────────────────────────────────────────────────────────

export function useUsers(params?: { role?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => apiClient.getUsers(params),
    refetchInterval: 30_000,
  });
}

export function usePendingUsers() {
  return useQuery({
    queryKey: ['users', 'pending'],
    queryFn: () => apiClient.getPendingUsers(),
    refetchInterval: 15_000,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['users'] }); };

  const approve = useMutation({ mutationFn: (id: string) => apiClient.approveUser(id), onSuccess: invalidate });
  const lock = useMutation({ mutationFn: (id: string) => apiClient.lockUser(id), onSuccess: invalidate });
  const unlock = useMutation({ mutationFn: (id: string) => apiClient.unlockUser(id), onSuccess: invalidate });
  const resetPassword = useMutation({ mutationFn: (id: string) => apiClient.resetUserPassword(id) });
  const deleteUser = useMutation({ mutationFn: (id: string) => apiClient.deleteUser(id), onSuccess: invalidate });
  const updateUser = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiClient.updateUser>[1] }) => apiClient.updateUser(id, data),
    onSuccess: invalidate,
  });
  const createUser = useMutation({
    mutationFn: (data: Parameters<typeof apiClient.createUser>[0]) => apiClient.createUser(data),
    onSuccess: invalidate,
  });

  return { approve, lock, unlock, resetPassword, deleteUser, updateUser, createUser };
}

// ── Slots ──────────────────────────────────────────────────────────────

export function useSlots() {
  return useQuery({
    queryKey: ['slots'],
    queryFn: () => apiClient.getSlots(),
    refetchInterval: 10_000,
  });
}

export function useSlotVMs(slot: number | null) {
  return useQuery({
    queryKey: ['slotVMs', slot],
    queryFn: () => apiClient.getSlotVMs(slot!),
    enabled: slot !== null,
    refetchInterval: 5_000,
  });
}

export function useSlotMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['slots'] });
    void qc.invalidateQueries({ queryKey: ['slotVMs'] });
    void qc.invalidateQueries({ queryKey: ['diagnostics'] });
  };

  const deploy = useMutation({
    mutationFn: ({ slot, scenarioId }: { slot: number; scenarioId: string }) => apiClient.deploySlot(slot, scenarioId),
    onSuccess: invalidate,
  });
  const destroy = useMutation({ mutationFn: (slot: number) => apiClient.destroySlot(slot), onSuccess: invalidate });
  const reset = useMutation({ mutationFn: (slot: number) => apiClient.resetSlot(slot), onSuccess: invalidate });
  const shutdown = useMutation({ mutationFn: (slot: number) => apiClient.shutdownSlot(slot), onSuccess: invalidate });
  const start = useMutation({ mutationFn: (slot: number) => apiClient.startSlot(slot), onSuccess: invalidate });
  const forceDestroy = useMutation({ mutationFn: (slot: number) => apiClient.forceDestroySlot(slot), onSuccess: invalidate });
  const deployAll = useMutation({ mutationFn: (scenarioId: string) => apiClient.deployAll(scenarioId), onSuccess: invalidate });

  return { deploy, destroy, reset, shutdown, start, forceDestroy, deployAll };
}

export function useSlotDiagnostics(slot: number | null, enabled = true) {
  return useQuery({
    queryKey: ['diagnostics', slot],
    queryFn: () => apiClient.getSlotDiagnostics(slot!),
    enabled: enabled && slot !== null,
    refetchInterval: 15_000,
  });
}

export function useVMMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['slotVMs'] });
    void qc.invalidateQueries({ queryKey: ['diagnostics'] });
  };

  const start = useMutation({ mutationFn: (vmId: number) => apiClient.startVM(vmId), onSuccess: invalidate });
  const shutdown = useMutation({ mutationFn: (vmId: number) => apiClient.shutdownVM(vmId), onSuccess: invalidate });
  const stop = useMutation({ mutationFn: (vmId: number) => apiClient.stopVM(vmId), onSuccess: invalidate });
  const reboot = useMutation({ mutationFn: (vmId: number) => apiClient.rebootVM(vmId), onSuccess: invalidate });
  const rollback = useMutation({ mutationFn: (vmId: number) => apiClient.rollbackVM(vmId), onSuccess: invalidate });

  return { start, shutdown, stop, reboot, rollback };
}

// ── Scenarios ──────────────────────────────────────────────────────────

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: () => apiClient.getScenarios(),
    staleTime: 60_000,
  });
}

// ── Audit ──────────────────────────────────────────────────────────────

export function useAuditLog(params?: { action?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => apiClient.getAuditLog(params),
    refetchInterval: 30_000,
  });
}

// ── Hints ──────────────────────────────────────────────────────────────

export function useHintMutation() {
  return useMutation({
    mutationFn: ({ slot, message }: { slot: number; message: string }) => apiClient.sendHint(slot, message),
  });
}
