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
  /** Deploy a scenario to a specific slot. */
  async deploy(
    slotNumber: number,
    scenarioId: string,
    onOutput: OutputCallback,
  ): Promise<void> {
    const workspace = `student-slot-${String(slotNumber).padStart(2, '0')}`;
    const scenarioDir = path.join(REPO_ROOT, 'terraform/scenarios', scenarioId);

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
    const scenarioDir = path.join(REPO_ROOT, 'terraform/scenarios', scenarioId);

    await this.exec(['workspace', 'select', workspace], scenarioDir, onOutput);

    const varsFile = this.buildVarFile(slotNumber, scenarioId);
    await this.exec(
      ['destroy', `-var-file=${varsFile}`, '-auto-approve', '-input=false'],
      scenarioDir,
      onOutput,
    );
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

  /** Execute a terraform command, streaming stdout/stderr. */
  private exec(
    args: string[],
    cwd: string,
    onOutput?: OutputCallback,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('terraform', args, {
        cwd,
        env: { ...process.env, TF_IN_AUTOMATION: '1' },
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
