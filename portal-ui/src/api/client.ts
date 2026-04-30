import type {
  User, LoginResponse, RegisterResponse, ApiError,
  LabSlot, VMInfo, Scenario, Hint, AuditEntry, Pagination, ObjectiveProgress,
  SlotDiagnostics,
} from '../types';

const BASE_URL = '/api';
const REFRESH_TOKEN_KEY = 'lab_portal_refresh_token';

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<void> | null = null;

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Attempt a single token refresh using the stored refresh token.
   * Deduplicates concurrent refresh attempts into one request.
   */
  private async tryRefreshToken(): Promise<boolean> {
    const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return false;

    if (!this.refreshPromise) {
      this.refreshPromise = this.doRefresh(refreshToken);
    }

    try {
      await this.refreshPromise;
      return true;
    } catch {
      return false;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefresh(refreshToken: string): Promise<void> {
    const resp = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) throw new Error('Refresh failed');
    const tokens = await resp.json() as { access_token: string; refresh_token: string };
    this.accessToken = tokens.access_token;
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }

  private async request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...init?.headers as Record<string, string>,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const resp = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
    });

    // On 401, attempt a single token refresh and retry the request once
    if (resp.status === 401 && !isRetry && !path.startsWith('/auth/')) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request<T>(path, init, true);
      }
    }

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: resp.statusText })) as ApiError;
      const err = new Error(body.error || `HTTP ${resp.status}`);
      (err as Error & { status: number; details?: ApiError['details'] }).status = resp.status;
      (err as Error & { details?: ApiError['details'] }).details = body.details;
      throw err;
    }

    return resp.json() as Promise<T>;
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(data: {
    email: string;
    username: string;
    password: string;
    full_name: string;
    student_id?: string;
  }): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(refreshToken: string): Promise<void> {
    await this.request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    return this.request('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  /**
   * Scheduled token refresh that uses the same dedup guard as 401 retries.
   * Prevents token rotation races between the interval and concurrent requests.
   */
  async scheduledRefresh(): Promise<boolean> {
    return this.tryRefreshToken();
  }

  async getMe(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/me');
  }

  // ── Users ────────────────────────────────────────────────────────────

  async getUsers(params?: { role?: string; status?: string; page?: number; limit?: number }): Promise<{ users: User[]; pagination: Pagination }> {
    const qs = new URLSearchParams();
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.request(`/users${query ? `?${query}` : ''}`);
  }

  async getPendingUsers(): Promise<{ users: User[] }> {
    return this.request('/users/pending');
  }

  async createUser(data: { email: string; username: string; password: string; full_name: string; student_id?: string; role?: string }): Promise<{ user: User }> {
    return this.request('/users', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateUser(id: string, data: Partial<{ role: string; status: string; lab_slot: number | null; full_name: string; student_id: string | null }>): Promise<{ user: User }> {
    return this.request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async approveUser(id: string): Promise<{ user: User }> {
    return this.request(`/users/${id}/approve`, { method: 'POST' });
  }

  async lockUser(id: string): Promise<{ message: string }> {
    return this.request(`/users/${id}/lock`, { method: 'POST' });
  }

  async unlockUser(id: string): Promise<{ message: string }> {
    return this.request(`/users/${id}/unlock`, { method: 'POST' });
  }

  async resetUserPassword(id: string): Promise<{ message: string; temporary_password: string }> {
    return this.request(`/users/${id}/reset-password`, { method: 'POST' });
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.request(`/users/${id}`, { method: 'DELETE' });
  }

  // ── Slots ────────────────────────────────────────────────────────────

  async getSlots(): Promise<{ slots: LabSlot[] }> {
    return this.request('/slots');
  }

  async getSlot(slot: number): Promise<{ slot: LabSlot }> {
    return this.request(`/slots/${slot}`);
  }

  async deploySlot(slot: number, scenarioId: string): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/deploy`, { method: 'POST', body: JSON.stringify({ scenario_id: scenarioId }) });
  }

  async destroySlot(slot: number): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/destroy`, { method: 'DELETE' });
  }

  async resetSlot(slot: number): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/reset`, { method: 'POST' });
  }

  async shutdownSlot(slot: number): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/shutdown`, { method: 'POST' });
  }

  async startSlot(slot: number): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/start`, { method: 'POST' });
  }

  async forceDestroySlot(slot: number): Promise<{ message: string }> {
    return this.request(`/slots/${slot}/force-destroy`, { method: 'POST' });
  }

  async getSlotDiagnostics(slot: number): Promise<{ diagnostics: SlotDiagnostics }> {
    return this.request(`/slots/${slot}/diagnostics`);
  }

  async getSlotVMs(slot: number): Promise<{ vms: VMInfo[] }> {
    return this.request(`/slots/${slot}/vms`);
  }

  async deployAll(scenarioId: string): Promise<{ message: string; slots: number[] }> {
    return this.request('/slots/deploy-all', { method: 'POST', body: JSON.stringify({ scenario_id: scenarioId }) });
  }

  // ── VM lifecycle ─────────────────────────────────────────────────────
  // Per-VM controls. Routes wait for the Proxmox task before responding so
  // the UI can refetch slot VMs on resolve. Rollback may take several minutes.

  async startVM(vmId: number): Promise<{ message: string; vmid: number }> {
    return this.request(`/vms/${vmId}/start`, { method: 'POST' });
  }

  async shutdownVM(vmId: number): Promise<{ message: string; vmid: number }> {
    return this.request(`/vms/${vmId}/shutdown`, { method: 'POST' });
  }

  async stopVM(vmId: number): Promise<{ message: string; vmid: number }> {
    return this.request(`/vms/${vmId}/stop`, { method: 'POST' });
  }

  async rebootVM(vmId: number): Promise<{ message: string; vmid: number }> {
    return this.request(`/vms/${vmId}/reboot`, { method: 'POST' });
  }

  async rollbackVM(vmId: number): Promise<{ message: string; vmid: number }> {
    return this.request(`/vms/${vmId}/rollback`, { method: 'POST' });
  }

  // ── Scenarios ────────────────────────────────────────────────────────

  async getScenarios(): Promise<{ scenarios: Scenario[] }> {
    return this.request('/scenarios');
  }

  async getScenario(id: string): Promise<{ scenario: Scenario }> {
    return this.request(`/scenarios/${id}`);
  }

  // ── Hints ────────────────────────────────────────────────────────────

  async getHints(slot?: number): Promise<{ hints: Hint[] }> {
    const qs = slot ? `?slot=${slot}` : '';
    return this.request(`/hints${qs}`);
  }

  async sendHint(slot: number, message: string): Promise<{ hint: Hint }> {
    return this.request('/hints', { method: 'POST', body: JSON.stringify({ slot, message }) });
  }

  async markHintRead(id: string): Promise<{ hint: Hint }> {
    return this.request(`/hints/${id}/read`, { method: 'PATCH' });
  }

  // ── Objectives ───────────────────────────────────────────────────────

  async getObjectives(): Promise<{ objectives: ObjectiveProgress[] }> {
    return this.request('/objectives');
  }

  async getSlotObjectives(slot: number): Promise<{ objectives: ObjectiveProgress[] }> {
    return this.request(`/objectives/slot/${slot}`);
  }

  async completeObjective(objectiveN: number, slotNumber?: number, scenarioId?: string): Promise<{ objective: ObjectiveProgress }> {
    const body: Record<string, unknown> = {};
    if (slotNumber) body.slot_number = slotNumber;
    if (scenarioId) body.scenario_id = scenarioId;
    return this.request(`/objectives/${objectiveN}/complete`, { method: 'POST', body: JSON.stringify(body) });
  }

  // ── Audit ────────────────────────────────────────────────────────────

  async getAuditLog(params?: { actor_id?: string; action?: string; from_date?: string; to_date?: string; page?: number; limit?: number }): Promise<{ entries: AuditEntry[]; pagination: Pagination }> {
    const qs = new URLSearchParams();
    if (params?.actor_id) qs.set('actor_id', params.actor_id);
    if (params?.action) qs.set('action', params.action);
    if (params?.from_date) qs.set('from_date', params.from_date);
    if (params?.to_date) qs.set('to_date', params.to_date);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return this.request(`/audit${query ? `?${query}` : ''}`);
  }

  // ── Console ──────────────────────────────────────────────────────────

  async getConsoleVMs(): Promise<{ vms: VMInfo[] }> {
    return this.request('/consoles/vms');
  }

  async getConsoleTicket(vmId: number): Promise<{ ticket: string; wsUrl: string; port: number }> {
    return this.request('/consoles/ticket', { method: 'POST', body: JSON.stringify({ vmId }) });
  }

  // ── Blue Team SOC ────────────────────────────────────────────────────
  // Mints a short-lived httpOnly cookie (soc_session) scoped to /api/soc so
  // the iframe's requests to the Wazuh dashboard are authenticated without
  // exposing the access token to the framed origin.

  async grantSocAccess(): Promise<{ ok: true; expires_in_seconds: number; dashboard_url: string }> {
    return this.request('/soc/grant', { method: 'POST' });
  }

  async revokeSocAccess(): Promise<{ ok: true }> {
    return this.request('/soc/revoke', { method: 'POST' });
  }
}

export const apiClient = new ApiClient();
