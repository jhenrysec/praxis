/** Proxmox VE API client — uses API token auth (no session tickets). */

import { Agent, fetch as undiciFetch, type Dispatcher } from 'undici';

export interface ProxmoxVM {
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

export interface ProxmoxSnapshot {
  name: string;
  description?: string;
  snaptime?: number;
  parent?: string;
  vmstate?: number;
}

export interface ProxmoxStorageVolume {
  volid: string;
  vmid?: number;
  format: string;
  size: number;
  content: string;
  ctime?: number;
}

interface TaskStatus {
  status: 'running' | 'stopped';
  exitstatus?: string;
  upid: string;
  type: string;
  starttime: number;
}

interface ProxmoxResponse<T> {
  data: T;
}

class ProxmoxService {
  private baseUrl: string;
  private tokenId: string;
  private tokenSecret: string;
  private node: string;
  private dispatcher?: Dispatcher;

  constructor() {
    this.baseUrl = process.env.PROXMOX_URL || 'https://172.16.0.10:8006';
    if (!process.env.PROXMOX_TOKEN_ID) throw new Error('PROXMOX_TOKEN_ID not set');
    if (!process.env.PROXMOX_TOKEN_SECRET) throw new Error('PROXMOX_TOKEN_SECRET not set');
    this.tokenId = process.env.PROXMOX_TOKEN_ID;
    this.tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
    this.node = process.env.PROXMOX_NODE || 'pve01';

    // Proxmox typically uses a self-signed cert. PROXMOX_INSECURE=true disables
    // verification for this client only (scoped via a dedicated undici dispatcher),
    // leaving the process-wide TLS trust store untouched.
    if (process.env.PROXMOX_INSECURE === 'true') {
      this.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    }
  }

  get nodeName(): string {
    return this.node;
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `PVEAPIToken=${this.tokenId}=${this.tokenSecret}`,
      'Content-Type': 'application/json',
    };
  }

  private async fetchApi<T>(path: string, init?: Parameters<typeof undiciFetch>[1]): Promise<T> {
    const url = `${this.baseUrl}/api2/json${path}`;

    const fetchInit: Parameters<typeof undiciFetch>[1] = {
      ...init,
      headers: { ...this.headers, ...init?.headers },
    };
    if (this.dispatcher) fetchInit.dispatcher = this.dispatcher;

    const resp = await undiciFetch(url, fetchInit);

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

  /** Get VMs whose tag list contains any tag starting with the prefix.
   *  Used by force-destroy to find slot VMs even when Terraform state is gone. */
  async getVMsByTagPrefix(prefix: string): Promise<ProxmoxVM[]> {
    const vms = await this.getVMs();
    return vms.filter((vm) =>
      vm.tags?.split(/[,;]/).some((t) => t.trim().startsWith(prefix)),
    );
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

  /** Start a VM. Returns UPID for task tracking. */
  async startVM(vmId: number): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}/status/start`,
      { method: 'POST' },
    );
  }

  /** Graceful ACPI shutdown. Falls back to hard stop after timeoutSeconds. */
  async shutdownVM(vmId: number, timeoutSeconds = 60): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}/status/shutdown`,
      {
        method: 'POST',
        body: JSON.stringify({ timeout: timeoutSeconds, forceStop: 1 }),
      },
    );
  }

  /** Hard power-off. Use when graceful shutdown is not responding. */
  async stopVM(vmId: number): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}/status/stop`,
      { method: 'POST' },
    );
  }

  /** Graceful reboot via ACPI. */
  async rebootVM(vmId: number, timeoutSeconds = 60): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}/status/reboot`,
      {
        method: 'POST',
        body: JSON.stringify({ timeout: timeoutSeconds }),
      },
    );
  }

  /** Delete a VM. VM must be stopped first.
   *  purge=1 removes from jobs/backups/HA; destroyUnreferencedDisks=1 reaps orphan disks. */
  async deleteVM(vmId: number): Promise<string> {
    const params = new URLSearchParams({
      purge: '1',
      'destroy-unreferenced-disks': '1',
    });
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}?${params}`,
      { method: 'DELETE' },
    );
  }

  /** List volumes on a storage. Optionally filter by vmid (server-side filter).
   *  Used by deploy preflight to find orphan disks/cloud-init datasets that
   *  Terraform left behind when state was lost or destroy was incomplete. */
  async listStorageContent(storage: string, vmId?: number): Promise<ProxmoxStorageVolume[]> {
    const path = vmId !== undefined
      ? `/nodes/${this.node}/storage/${encodeURIComponent(storage)}/content?vmid=${vmId}`
      : `/nodes/${this.node}/storage/${encodeURIComponent(storage)}/content`;
    return this.fetchApi<ProxmoxStorageVolume[]>(path);
  }

  /** Delete a single storage volume by volid (e.g. "local-zfs:vm-200-disk-0").
   *  Proxmox refuses to delete volumes attached to existing VMs — caller must
   *  ensure the VM is gone first. Returns UPID for tasks that run async. */
  async deleteStorageVolume(storage: string, volid: string): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/storage/${encodeURIComponent(storage)}/content/${encodeURIComponent(volid)}`,
      { method: 'DELETE' },
    );
  }

  /** List snapshots for a VM. */
  async listSnapshots(vmId: number): Promise<ProxmoxSnapshot[]> {
    return this.fetchApi<ProxmoxSnapshot[]>(
      `/nodes/${this.node}/qemu/${vmId}/snapshot`,
    );
  }

  /** Roll a VM back to a named snapshot. Returns UPID. */
  async rollbackSnapshot(vmId: number, snapshotName: string): Promise<string> {
    return this.fetchApi<string>(
      `/nodes/${this.node}/qemu/${vmId}/snapshot/${encodeURIComponent(snapshotName)}/rollback`,
      { method: 'POST' },
    );
  }

  /** Poll a UPID until completion or timeout. Returns final task status. */
  async waitForTask(upid: string, timeoutMs = 300000, pollMs = 1000): Promise<TaskStatus> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.fetchApi<TaskStatus>(
        `/nodes/${this.node}/tasks/${encodeURIComponent(upid)}/status`,
      );
      if (status.status === 'stopped') {
        if (status.exitstatus && status.exitstatus !== 'OK') {
          throw new Error(`Proxmox task ${upid} failed: ${status.exitstatus}`);
        }
        return status;
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }
    throw new Error(`Proxmox task ${upid} timed out after ${timeoutMs}ms`);
  }
}

export const proxmoxService = new ProxmoxService();
