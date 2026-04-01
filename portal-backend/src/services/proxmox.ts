/** Proxmox VE API client — uses API token auth (no session tickets). */

interface ProxmoxVM {
  vmid: number;
  name: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  uptime: number;
  tags?: string;
  netin?: number;
  netout?: number;
}

interface VNCTicket {
  ticket: string;
  port: number;
  cert?: string;
}

interface ProxmoxResponse<T> {
  data: T;
}

class ProxmoxService {
  private baseUrl: string;
  private tokenId: string;
  private tokenSecret: string;
  private node: string;

  constructor() {
    this.baseUrl = process.env.PROXMOX_URL || 'https://172.16.0.10:8006';
    if (!process.env.PROXMOX_TOKEN_ID) throw new Error('PROXMOX_TOKEN_ID not set');
    if (!process.env.PROXMOX_TOKEN_SECRET) throw new Error('PROXMOX_TOKEN_SECRET not set');
    this.tokenId = process.env.PROXMOX_TOKEN_ID;
    this.tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
    this.node = process.env.PROXMOX_NODE || 'pve01';
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api2/json${path}`;

    const resp = await fetch(url, {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Proxmox API ${resp.status}: ${body}`);
    }

    const json = (await resp.json()) as ProxmoxResponse<T>;
    return json.data;
  }

  /** List all QEMU VMs on the node. */
  async getVMs(): Promise<ProxmoxVM[]> {
    return this.fetchApi<ProxmoxVM[]>(`/nodes/${this.node}/qemu`);
  }

  /** Get VMs matching a specific tag (e.g., "student-slot-5"). */
  async getVMsByTag(tag: string): Promise<ProxmoxVM[]> {
    const vms = await this.getVMs();
    return vms.filter((vm) => vm.tags?.split(/[,;]/).includes(tag));
  }

  /** Get VMs for a specific slot by tag convention. */
  async getVMsForSlot(slotNumber: number): Promise<ProxmoxVM[]> {
    const tag = `student-slot-${slotNumber}`;
    return this.getVMsByTag(tag);
  }

  /** Get current status of a specific VM. */
  async getVMStatus(vmId: number): Promise<ProxmoxVM> {
    return this.fetchApi<ProxmoxVM>(`/nodes/${this.node}/qemu/${vmId}/status/current`);
  }

  /** Request a VNC proxy ticket for WebSocket console access. */
  async getVNCTicket(vmId: number): Promise<VNCTicket> {
    return this.fetchApi<VNCTicket>(
      `/nodes/${this.node}/qemu/${vmId}/vncproxy`,
      {
        method: 'POST',
        body: JSON.stringify({ websocket: 1 }),
      },
    );
  }
}

export const proxmoxService = new ProxmoxService();
