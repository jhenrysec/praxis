import { create } from 'zustand';
import type { Scenario } from '@/types';

interface ScenarioState {
  scenarios: Scenario[];
  selectedScenario: string | null;
  setScenarios: (scenarios: Scenario[]) => void;
  selectScenario: (name: string | null) => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  scenarios: [],
  selectedScenario: null,
  setScenarios: (scenarios) => set({ scenarios }),
  selectScenario: (name) => set({ selectedScenario: name }),
}));
