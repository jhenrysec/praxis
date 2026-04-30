import type {
  Scenario,
  LabSlot,
  VMStatus,
  DeployRequest,
  DeployResponse,
  SlotDiagnostics,
} from '@/types';

const BASE_URL = '/api';

/** Stored JWT access token — set via setAccessToken(). */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export async function fetchScenarios(): Promise<Scenario[]> {
  const data = await request<{ scenarios: Scenario[] }>('/scenarios');
  return data.scenarios;
}

export async function fetchScenario(id: string): Promise<Scenario> {
  const data = await request<{ scenario: Scenario }>(`/scenarios/${id}`);
  return data.scenario;
}

// ── Lab Slots ───────────────────────────────────────────────────────────────

export async function fetchSlots(): Promise<LabSlot[]> {
  const data = await request<{ slots: LabSlot[] }>('/slots');
  return data.slots;
}

export async function fetchSlot(slot: number): Promise<LabSlot> {
  const data = await request<{ slot: LabSlot }>(`/slots/${slot}`);
  return data.slot;
}

// ── VMs ─────────────────────────────────────────────────────────────────────

export async function fetchSlotVMs(slot: number): Promise<VMStatus[]> {
  const data = await request<{ vms: VMStatus[] }>(`/slots/${slot}/vms`);
  return data.vms;
}

// ── Deploy / Destroy ────────────────────────────────────────────────────────

export async function deployScenario(req: DeployRequest): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${req.slot_number}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ scenario_id: req.scenario_id }),
  });
  return { status: 'started', message: data.message };
}

export async function destroySlot(slot: number): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${slot}/destroy`, {
    method: 'DELETE',
  });
  return { status: 'started', message: data.message };
}

export async function resetSlot(slot: number): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${slot}/reset`, {
    method: 'POST',
  });
  return { status: 'started', message: data.message };
}

export async function shutdownSlot(slot: number): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${slot}/shutdown`, {
    method: 'POST',
  });
  return { status: 'started', message: data.message };
}

export async function startSlot(slot: number): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${slot}/start`, {
    method: 'POST',
  });
  return { status: 'started', message: data.message };
}

export async function forceDestroySlot(slot: number): Promise<DeployResponse> {
  const data = await request<{ message: string; slot_number: number }>(`/slots/${slot}/force-destroy`, {
    method: 'POST',
  });
  return { status: 'started', message: data.message };
}

export async function fetchSlotDiagnostics(slot: number): Promise<SlotDiagnostics> {
  const data = await request<{ diagnostics: SlotDiagnostics }>(`/slots/${slot}/diagnostics`);
  return data.diagnostics;
}

// ── Per-VM lifecycle ────────────────────────────────────────────────────────

export async function startVM(vmId: number): Promise<{ message: string; vmid: number }> {
  return request(`/vms/${vmId}/start`, { method: 'POST' });
}

export async function shutdownVM(vmId: number): Promise<{ message: string; vmid: number }> {
  return request(`/vms/${vmId}/shutdown`, { method: 'POST' });
}

export async function stopVM(vmId: number): Promise<{ message: string; vmid: number }> {
  return request(`/vms/${vmId}/stop`, { method: 'POST' });
}

export async function rebootVM(vmId: number): Promise<{ message: string; vmid: number }> {
  return request(`/vms/${vmId}/reboot`, { method: 'POST' });
}

export async function rollbackVM(vmId: number): Promise<{ message: string; vmid: number }> {
  return request(`/vms/${vmId}/rollback`, { method: 'POST' });
}

// ── WebSocket status stream ─────────────────────────────────────────────────

export function connectStatusStream(
  onMessage: (data: string) => void,
  onClose?: () => void,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/status`;
  const ws = new WebSocket(accessToken ? `${wsUrl}?token=${accessToken}` : wsUrl);

  ws.onmessage = (event) => {
    onMessage(event.data as string);
  };

  ws.onclose = () => {
    onClose?.();
  };

  return ws;
}
