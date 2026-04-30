/**
 * Terraform CLI wrapper — spawns terraform commands as child processes.
 * Output is streamed line-by-line to the caller (for WebSocket relay).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.env.REPO_ROOT || '/opt/vuln-lab';

export type OutputCallback = (line: string) => void;

class TerraformService {
  /**
   * Resolve a scenario ID to its terraform directory.
   * Accepts either format: "SCEN-005", "browser_exploit_cve_2026_2441",
   * or the full dir name "SCEN-005_browser_exploit_cve_2026_2441".
   */
  private resolveScenarioDir(scenarioId: string): string {
    // Try unified structure first: scenarios/SCEN-XXX_name/terraform/
    const scenariosRoot = path.join(REPO_ROOT, 'scenarios');
    if (fs.existsSync(scenariosRoot)) {
      const entries = fs.readdirSync(scenariosRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
        // Match by exact name, prefix (SCEN-005), or suffix (_browser_exploit_...)
        if (
          entry.name === scenarioId ||
          entry.name.startsWith(`${scenarioId}_`) ||
          entry.name.endsWith(`_${scenarioId}`)
        ) {
          const tfDir = path.join(scenariosRoot, entry.name, 'terraform');
          if (fs.existsSync(tfDir)) return tfDir;
        }
      }
    }

    // Fall back to backward-compat symlinks: terraform/scenarios/name/
    const symlinkDir = path.join(REPO_ROOT, 'terraform/scenarios', scenarioId);
    if (fs.existsSync(symlinkDir)) return symlinkDir;

    throw new Error(`Scenario directory not found for: ${scenarioId}`);
  }

  /** Deploy a scenario to a specific slot. */
  async deploy(
    slotNumber: number,
    scenarioId: string,
    onOutput: OutputCallback,
  ): Promise<void> {
    const workspace = `student-slot-${String(slotNumber).padStart(2, '0')}`;
    const scenarioDir = this.resolveScenarioDir(scenarioId);

    // Create or select workspace
    try {
      await this.exec(['workspace', 'new', workspace], scenarioDir, onOutput);
    } catch {
      await this.exec(['workspace', 'select', workspace], scenarioDir, onOutput);
    }

    await this.exec(['init', '-input=false'], scenarioDir, onOutput);

    const varsFile = this.buildVarFile(slotNumber, scenarioId);
    await this.exec(
      ['apply', `-var-file=${varsFile}`, '-auto-approve', '-input=false'],
      scenarioDir,
      onOutput,
    );
  }

  /** Destroy all resources in a slot's workspace. */
  async destroy(
    slotNumber: number,
    scenarioId: string,
    onOutput: OutputCallback,
  ): Promise<void> {
    const workspace = `student-slot-${String(slotNumber).padStart(2, '0')}`;
    const scenarioDir = this.resolveScenarioDir(scenarioId);

    await this.exec(['workspace', 'select', workspace], scenarioDir, onOutput);

    const varsFile = this.buildVarFile(slotNumber, scenarioId);
    await this.exec(
      ['destroy', `-var-file=${varsFile}`, '-auto-approve', '-input=false'],
      scenarioDir,
      onOutput,
    );
  }

  /**
   * Force-remove a workspace after manual VM cleanup.
   * Used by force-destroy when Terraform state is irrecoverable and VMs
   * were deleted directly via Proxmox API. Switches to default before
   * deleting so the target workspace is not in use.
   * Best-effort: logs but does not throw on individual step failures.
   */
  async cleanupWorkspace(
    slotNumber: number,
    scenarioId: string,
    onOutput: OutputCallback,
  ): Promise<void> {
    const workspace = `student-slot-${String(slotNumber).padStart(2, '0')}`;
    let scenarioDir: string;
    try {
      scenarioDir = this.resolveScenarioDir(scenarioId);
    } catch (err) {
      onOutput(`[cleanup] scenario dir not found for ${scenarioId}; skipping workspace removal`);
      return;
    }

    try {
      await this.exec(['workspace', 'select', 'default'], scenarioDir, onOutput);
    } catch (err) {
      onOutput(`[cleanup] workspace select default failed (may not be initialized): ${(err as Error).message}`);
      return;
    }

    try {
      await this.exec(['workspace', 'delete', '-force', workspace], scenarioDir, onOutput);
      onOutput(`[cleanup] workspace ${workspace} removed`);
    } catch (err) {
      onOutput(`[cleanup] workspace delete failed (may not exist): ${(err as Error).message}`);
    }
  }

  /** Build a temporary tfvars JSON file for the given slot. */
  private buildVarFile(slotNumber: number, scenarioId: string): string {
    const vars = {
      slot_number: slotNumber,
      vm_id_base: 200 + (slotNumber - 1) * 10,
      scenario_name: scenarioId,
    };
    const tmpFile = `/tmp/slot-${slotNumber}.tfvars.json`;
    fs.writeFileSync(tmpFile, JSON.stringify(vars, null, 2));
    return tmpFile;
  }

  /**
   * Build env for the terraform child. Maps the backend's PROXMOX_* vars
   * (used by the Proxmox API client) onto the PROXMOX_VE_* names the
   * bpg/proxmox Terraform provider reads. Without this the provider errors
   * with "must provide either username and password, an API token, or a
   * ticket" because the scenario main.tf's provider block relies on env-var
   * auth (not hard-coded credentials).
   */
  private terraformEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, TF_IN_AUTOMATION: '1' };

    const url = process.env.PROXMOX_URL;
    if (url && !env.PROXMOX_VE_ENDPOINT) {
      env.PROXMOX_VE_ENDPOINT = url.endsWith('/') ? url : `${url}/`;
    }

    const tokenId = process.env.PROXMOX_TOKEN_ID;
    const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;
    if (tokenId && tokenSecret && !env.PROXMOX_VE_API_TOKEN) {
      env.PROXMOX_VE_API_TOKEN = `${tokenId}=${tokenSecret}`;
    }

    if (process.env.PROXMOX_INSECURE === 'true' && !env.PROXMOX_VE_INSECURE) {
      env.PROXMOX_VE_INSECURE = 'true';
    }

    return env;
  }

  /** Execute a terraform command, streaming stdout/stderr. */
  private exec(
    args: string[],
    cwd: string,
    onOutput?: OutputCallback,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('terraform', args, {
        cwd,
        env: this.terraformEnv(),
      });

      const handleData = (data: Buffer): void => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) onOutput?.(line);
        }
      };

      proc.stdout.on('data', handleData);
      proc.stderr.on('data', handleData);

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`terraform ${args[0]} exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }
}

export const terraformService = new TerraformService();
