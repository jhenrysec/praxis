/**
 * Scenario discovery — reads scenario.yaml files from the repo
 * to build the available scenario catalog.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ScenarioMeta } from '../types/index.js';

const REPO_ROOT = process.env.REPO_ROOT || '/opt/vuln-lab';
const SCENARIOS_DIR = path.join(REPO_ROOT, 'terraform/scenarios');

interface ScenarioYaml {
  id: string;
  name: string;
  display_name: string;
  difficulty: string;
  duration_hours: number;
  description: string;
  vm_count: number;
  focus_areas: string[];
  mitre_techniques: string[];
}

/** Parse a simple YAML scenario file (key: value format). */
function parseScenarioYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Handle array values like [a, b, c]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));
    }
    // Handle numeric values
    else if (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value)) {
      value = parseFloat(value);
    }

    result[key] = value;
  }

  return result;
}

/** Scan the scenarios directory for scenario.yaml files. */
export function loadScenarios(): ScenarioMeta[] {
  const scenarios: ScenarioMeta[] = [];

  if (!fs.existsSync(SCENARIOS_DIR)) return scenarios;

  const entries = fs.readdirSync(SCENARIOS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

    const yamlPath = path.join(SCENARIOS_DIR, entry.name, 'scenario.yaml');
    if (!fs.existsSync(yamlPath)) continue;

    try {
      const content = fs.readFileSync(yamlPath, 'utf-8');
      const parsed = parseScenarioYaml(content) as unknown as ScenarioYaml;

      scenarios.push({
        id: parsed.id || entry.name,
        name: parsed.name || entry.name,
        display_name: parsed.display_name || parsed.name || entry.name,
        difficulty: parsed.difficulty || 'Unknown',
        duration_hours: parsed.duration_hours || 0,
        vm_count: parsed.vm_count || 0,
        focus_areas: Array.isArray(parsed.focus_areas) ? parsed.focus_areas : [],
        mitre_techniques: Array.isArray(parsed.mitre_techniques) ? parsed.mitre_techniques : [],
        description: parsed.description || '',
      });
    } catch (err) {
      console.error(`[scenarios] failed to parse ${yamlPath}:`, err);
    }
  }

  return scenarios;
}

/** Get a single scenario by ID. */
export function getScenarioById(scenarioId: string): ScenarioMeta | null {
  const scenarios = loadScenarios();
  return scenarios.find((s) => s.id === scenarioId) ?? null;
}
