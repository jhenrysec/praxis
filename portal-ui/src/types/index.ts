export type Role = 'admin' | 'instructor' | 'student';
export type UserStatus = 'pending' | 'active' | 'locked' | 'deleted';

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  student_id: string | null;
  role: Role;
  status: UserStatus;
  lab_slot: number | null;
  created_at: string;
  last_login: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

export interface ApiError {
  error: string;
  details?: Array<{ path: string; message: string }>;
}

// ── Slots ──────────────────────────────────────────────────────────────

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
  user_id: string | null;
  scenario_id: string | null;
  status: SlotStatus;
  tf_workspace: string | null;
  deployed_at: string | null;
  last_reset: string | null;
  deploy_log: string | null;
  last_error: string | null;
}

// ── VMs ────────────────────────────────────────────────────────────────

export interface VMInfo {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  uptime: number;
  tags?: string;
}

// ── Diagnostics ────────────────────────────────────────────────────────

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

// ── Scenarios ──────────────────────────────────────────────────────────

export interface Scenario {
  id: string;
  name: string;
  display_name: string;
  difficulty: string;
  duration_hours: number;
  vm_count: number;
  focus_areas: string[];
  mitre_techniques: string[];
  description: string;
}

// ── Hints ──────────────────────────────────────────────────────────────

export interface Hint {
  id: string;
  from_user: string;
  to_slot: number;
  message: string;
  created_at: string;
  read_at: string | null;
}

// ── Audit ──────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// ── Pagination ─────────────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

// ── Objectives ─────────────────────────────────────────────────────────

export interface ObjectiveProgress {
  id: string;
  user_id: string;
  slot_number: number;
  scenario_id: string;
  objective_n: number;
  completed: boolean;
  completed_at: string | null;
}
