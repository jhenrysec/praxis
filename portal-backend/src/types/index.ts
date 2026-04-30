export type Role = 'admin' | 'instructor' | 'student';
export type UserStatus = 'pending' | 'active' | 'locked' | 'deleted';
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

export interface UserRow {
  id: string;
  email: string;
  username: string;
  password_hash: string;
  full_name: string;
  student_id: string | null;
  role: Role;
  status: UserStatus;
  lab_slot: number | null;
  created_at: Date;
  last_login: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
}

export interface UserPublic {
  id: string;
  email: string;
  username: string;
  full_name: string;
  student_id: string | null;
  role: Role;
  status: UserStatus;
  lab_slot: number | null;
  created_at: Date;
  last_login: Date | null;
  approved_by: string | null;
  approved_at: Date | null;
}

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface SlotRow {
  slot_number: number;
  user_id: string | null;
  scenario_id: string | null;
  status: SlotStatus;
  tf_workspace: string | null;
  deployed_at: Date | null;
  last_reset: Date | null;
  deploy_log: string | null;
  last_error: string | null;
}

export interface ScenarioAssignmentRow {
  id: string;
  slot_number: number;
  scenario_id: string;
  assigned_by: string;
  assigned_at: Date;
  completed: boolean;
  completed_at: Date | null;
}

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface ObjectiveProgressRow {
  id: string;
  user_id: string;
  slot_number: number;
  scenario_id: string;
  objective_n: number;
  completed: boolean;
  completed_at: Date | null;
}

export interface HintRow {
  id: string;
  from_user: string;
  to_slot: number;
  message: string;
  created_at: Date;
  read_at: Date | null;
}

export interface JWTPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface ScenarioMeta {
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

// Strip password_hash from user rows for API responses
export function toUserPublic(row: UserRow): UserPublic {
  const { password_hash: _, ...publicFields } = row;
  return publicFields;
}
