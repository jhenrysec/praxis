// ── Scenario Types ──────────────────────────────────────────────────────────

export interface Scenario {
  name: string;
  display_name: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  estimated_hours: number;
  status: 'ready' | 'in_development' | 'archived';
  focus_areas: string[];
  mitre_techniques: string[];
  vm_count: number;
  total_cpu: number;
  total_memory_mb: number;
}

export interface ScenarioDetails extends Scenario {
  objectives: string[];
  credentials: Credential[];
  network_map: NetworkZone[];
}

export interface Credential {
  host: string;
  username: string;
  password: string;
  notes: string;
}

export interface NetworkZone {
  name: string;
  bridge: string;
  zone: 'red' | 'blue' | 'ot';
  hosts: NetworkHost[];
}

export interface NetworkHost {
  name: string;
  ip: string;
  ports: number[];
  role: string;
}

// ── Slot Types ──────────────────────────────────────────────────────────────

export type SlotStatus =
  | 'empty'
  | 'deploying'
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'configuring'
  | 'resetting'
  | 'error'
  | 'destroying';

export interface LabSlot {
  slot_number: number;
  status: SlotStatus;
  scenario_id: string | null;
  scenario_name: string | null;
  deployed_at: string | null;
  user: string | null;
  last_error?: string | null;
  vms?: VMStatus[];
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

export interface VmDiagnostic {
  vmid: number;
  name: string;
  proxmox_status: string;
  has_baseline_snapshot: boolean;
  snapshot_count: number;
  tags: string[];
  uptime: number;
}

export interface SlotDiagnostics {
  slot_number: number;
  db_status: SlotStatus;
  db_scenario_id: string | null;
  vm_count: number;
  vms: VmDiagnostic[];
  orphan_vms: VmDiagnostic[];
  vms_without_baseline: number[];
  workspace_expected: string | null;
  advisories: string[];
}

// ── VM Types ────────────────────────────────────────────────────────────────

export type VMState = 'running' | 'stopped' | 'paused' | 'unknown';

export interface VMStatus {
  vmid: number;
  name: string;
  status: VMState;
  cpu: number;
  mem: number;
  maxmem: number;
  uptime: number;
  tags: string[];
  ip_address?: string;
  zone?: 'red' | 'blue' | 'ot';
}

// ── Deploy Types ────────────────────────────────────────────────────────────

export interface DeployRequest {
  scenario_id: string;
  slot_number: number;
}

export interface DeployResponse {
  status: 'started' | 'error';
  message: string;
  job_id?: string;
}

export interface AccessSheet {
  scenario: string;
  slot: number;
  attacker_ip: string;
  attacker_user: string;
  attacker_pass: string;
  targets: AccessTarget[];
  objectives_url: string;
}

export interface AccessTarget {
  host: string;
  ip: string;
  username?: string;
  password?: string;
  notes?: string;
}

// ── UI Types ────────────────────────────────────────────────────────────────

export type ViewMode = 'dashboard' | 'scenario' | 'slots';

export interface TerminalLine {
  timestamp: number;
  text: string;
  type: 'stdout' | 'stderr' | 'system';
}

export const DIFFICULTY_COLORS: Record<Scenario['difficulty'], string> = {
  Beginner: '#00e5a0',
  Intermediate: '#6c8fff',
  Advanced: '#facc15',
  Expert: '#fb7185',
};

export const STATUS_COLORS: Record<SlotStatus, { bg: string; text: string; border: string }> = {
  empty:       { bg: '#4b55631a', text: '#4b5563', border: '#4b556333' },
  deploying:   { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  running:     { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' },
  stopped:     { bg: '#6c8fff1a', text: '#6c8fff', border: '#6c8fff33' },
  starting:    { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  stopping:    { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  configuring: { bg: '#a78bfa1a', text: '#a78bfa', border: '#a78bfa33' },
  resetting:   { bg: '#a78bfa1a', text: '#a78bfa', border: '#a78bfa33' },
  error:       { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  destroying:  { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
};

export const PULSING_STATUSES: ReadonlySet<SlotStatus | VMState> = new Set<SlotStatus | VMState>([
  'running',
  'deploying',
  'starting',
  'stopping',
  'configuring',
  'resetting',
  'destroying',
]);

export const VM_STATE_COLORS: Record<VMState, { bg: string; text: string; border: string }> = {
  running: { bg: '#00e5a01a', text: '#00e5a0', border: '#00e5a033' },
  stopped: { bg: '#fb71851a', text: '#fb7185', border: '#fb718533' },
  paused:  { bg: '#facc151a', text: '#facc15', border: '#facc1533' },
  unknown: { bg: '#4b55631a', text: '#4b5563', border: '#4b556333' },
};
