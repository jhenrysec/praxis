/**
 * VNC console proxy — requests a VNC ticket from Proxmox and
 * provides the WebSocket URL for noVNC to connect through.
 */

import { proxmoxService } from './proxmox.js';

interface ConsoleTicket {
  ticket: string;
  port: number;
  wsUrl: string;
}

class ConsoleService {
  private proxmoxNode: string;

  constructor() {
    this.proxmoxNode = process.env.PROXMOX_NODE || 'pve01';
  }

  /**
   * Request a VNC ticket for a specific VM.
   * Returns the ticket + WebSocket URL that noVNC should connect to.
   */
  async getTicket(vmId: number): Promise<ConsoleTicket> {
    const vncData = await proxmoxService.getVNCTicket(vmId);

    const proxmoxUrl = process.env.PROXMOX_URL || 'https://172.16.0.10:8006';
    const wsUrl = `${proxmoxUrl.replace('https://', 'wss://').replace('http://', 'ws://')}/api2/json/nodes/${this.proxmoxNode}/qemu/${vmId}/vncwebsocket?port=${vncData.port}&vncticket=${encodeURIComponent(vncData.ticket)}`;

    return {
      ticket: vncData.ticket,
      port: vncData.port,
      wsUrl,
    };
  }
}

export const consoleService = new ConsoleService();
