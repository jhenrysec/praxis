import { useQuery } from '@tanstack/react-query';
import { fetchScenarios, fetchScenario } from '@/api/client';
import type { Scenario } from '@/types';

export function useScenarios() {
  return useQuery<Scenario[]>({
    queryKey: ['scenarios'],
    queryFn: fetchScenarios,
  });
}

export function useScenario(id: string | null) {
  return useQuery<Scenario>({
    queryKey: ['scenario', id],
    queryFn: () => fetchScenario(id!),
    enabled: id !== null,
  });
}
