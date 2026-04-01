import type {
  Scenario,
  LabSlot,
  VMStatus,
  DeployRequest,
  DeployResponse,
  AccessSheet,
} from '@/types';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Scenarios ───────────────────────────────────────────────────────────────

export async function fetchScenarios(): Promise<Scenario[]> {
  return request<Scenario[]>('/scenarios');
}

export async function fetchScenario(id: string): Promise<Scenario> {
  return request<Scenario>(`/scenarios/${id}`);
}

// ── Lab Slots ───────────────────────────────────────────────────────────────

export async function fetchSlots(): Promise<LabSlot[]> {
  return request<LabSlot[]>('/slots');
}

export async function fetchSlot(slot: number): Promise<LabSlot> {
  return request<LabSlot>(`/slots/${slot}`);
}

// ── VMs ─────────────────────────────────────────────────────────────────────

export async function fetchVMs(): Promise<VMStatus[]> {
  return request<VMStatus[]>('/vms');
}

export async function fetchSlotVMs(slot: number): Promise<VMStatus[]> {
  return request<VMStatus[]>(`/slots/${slot}/vms`);
}

// ── Deploy / Destroy ────────────────────────────────────────────────────────

export async function deployScenario(req: DeployRequest): Promise<DeployResponse> {
  return request<DeployResponse>(`/slots/${req.slot_number}/deploy`, {
    method: 'POST',
    body: JSON.stringify({ scenario_id: req.scenario_id }),
  });
}

export async function destroySlot(slot: number): Promise<DeployResponse> {
  return request<DeployResponse>(`/slots/${slot}/destroy`, {
    method: 'DELETE',
  });
}

export async function resetSlot(slot: number): Promise<DeployResponse> {
  return request<DeployResponse>(`/slots/${slot}/reset`, {
    method: 'POST',
  });
}

// ── Access Sheet ────────────────────────────────────────────────────────────

export async function fetchAccessSheet(slot: number): Promise<AccessSheet> {
  return request<AccessSheet>(`/slots/${slot}/access-sheet`);
}

// ── WebSocket for terminal output ───────────────────────────────────────────

export function connectDeployStream(
  slot: number,
  onMessage: (data: string) => void,
  onClose?: () => void,
): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws/deploy/${slot}`);

  ws.onmessage = (event) => {
    onMessage(event.data as string);
  };

  ws.onclose = () => {
    onClose?.();
  };

  return ws;
}
