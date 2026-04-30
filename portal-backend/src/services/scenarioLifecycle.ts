/**
 * Scenario lifecycle orchestration — wraps Proxmox and Terraform primitives
 * into the high-level actions the UI exposes: shutdown, start, reset,
 * force-destroy, and diagnostics.
 *
 * Each orchestration streams progress lines to the caller via onOutput so
 * routes can append to lab_slots.deploy_log for the terminal panel.
 */

import { proxmoxService, type ProxmoxVM, type ProxmoxSnapshot } from './proxmox.js';
import { terraformService } from './terraform.js';
import { query } from '../db/pool.js';

export type OutputCallback = (line: string) => void;

export const BASELINE_SNAPSHOT = 'baseline';

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
  db_status: string;
  db_scenario_id: string | null;
  vm_count: number;
  vms: VmDiagnostic[];
  orphan_vms: VmDiagnostic[];
  vms_without_baseline: number[];
  workspace_expected: string | null;
  advisories: string[];
}

class ScenarioLifecycleService {
  /**
   * Graceful shutdown of every VM in a slot.
   * Caller is responsible for setting DB status transitions.
   */
  async shutdownSlot(slotNumber: number, onOutput: OutputCallback): Promise<void> {
    const vms = await proxmoxService.getVMsForSlot(slotNumber);
    if (vms.length === 0) {
      onOutput(`[shutdown] slot ${slotNumber}: no VMs found`);
      return;
    }

    onOutput(`[shutdown] slot ${slotNumber}: ${vms.length} VM(s) — issuing ACPI shutdown`);

    const tasks = vms.map(async (vm) => {
      if (vm.status === 'stopped') {
        onOutput(`[shutdown] vm ${vm.vmid} (${vm.name}) already stopped`);
        return;
      }
      try {
        const upid = await proxmoxService.shutdownVM(vm.vmid);
        onOutput(`[shutdown] vm ${vm.vmid}: task ${upid}`);
        await proxmoxService.waitForTask(upid, 120_000);
        onOutput(`[shutdown] vm ${vm.vmid}: stopped`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`[shutdown] vm ${vm.vmid}: FAILED — ${msg}`);
        throw err;
      }
    });

    await Promise.all(tasks);
    onOutput(`[shutdown] slot ${slotNumber}: all VMs stopped`);
  }

  /**
   * Start every stopped VM in a slot.
   */
  async startSlot(slotNumber: number, onOutput: OutputCallback): Promise<void> {
    const vms = await proxmoxService.getVMsForSlot(slotNumber);
    if (vms.length === 0) {
      onOutput(`[start] slot ${slotNumber}: no VMs found`);
      return;
    }

    onOutput(`[start] slot ${slotNumber}: ${vms.length} VM(s) — powering on`);

    const tasks = vms.map(async (vm) => {
      if (vm.status === 'running') {
        onOutput(`[start] vm ${vm.vmid} (${vm.name}) already running`);
        return;
      }
      try {
        const upid = await proxmoxService.startVM(vm.vmid);
        onOutput(`[start] vm ${vm.vmid}: task ${upid}`);
        await proxmoxService.waitForTask(upid, 120_000);
        onOutput(`[start] vm ${vm.vmid}: running`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`[start] vm ${vm.vmid}: FAILED — ${msg}`);
        throw err;
      }
    });

    await Promise.all(tasks);
    onOutput(`[start] slot ${slotNumber}: all VMs running`);
  }

  /**
   * Rollback every VM in a slot to its baseline snapshot.
   * Fails fast if any VM is missing the baseline snapshot — partial reset
   * leaves the scenario in an inconsistent state.
   */
  async resetSlot(slotNumber: number, onOutput: OutputCallback): Promise<void> {
    const vms = await proxmoxService.getVMsForSlot(slotNumber);
    if (vms.length === 0) {
      throw new Error(`No VMs found for slot ${slotNumber}`);
    }

    onOutput(`[reset] slot ${slotNumber}: verifying baseline snapshots on ${vms.length} VM(s)`);

    // Pre-check every VM has a baseline snapshot before touching anything
    const snapshotChecks = await Promise.all(
      vms.map(async (vm) => ({
        vm,
        snapshots: await proxmoxService.listSnapshots(vm.vmid),
      })),
    );

    const missing = snapshotChecks.filter(
      (c) => !c.snapshots.some((s) => s.name === BASELINE_SNAPSHOT),
    );
    if (missing.length > 0) {
      const names = missing.map((c) => `${c.vm.vmid} (${c.vm.name})`).join(', ');
      throw new Error(
        `Missing baseline snapshot on: ${names}. Take baseline snapshots before enabling reset.`,
      );
    }

    onOutput(`[reset] slot ${slotNumber}: rolling back to '${BASELINE_SNAPSHOT}' on all VMs`);

    const tasks = vms.map(async (vm) => {
      try {
        const upid = await proxmoxService.rollbackSnapshot(vm.vmid, BASELINE_SNAPSHOT);
        onOutput(`[reset] vm ${vm.vmid}: rollback task ${upid}`);
        await proxmoxService.waitForTask(upid, 300_000);
        onOutput(`[reset] vm ${vm.vmid}: rolled back`);

        // Ensure VM is running after rollback (rollback may leave it off)
        const status = await proxmoxService.getVMStatus(vm.vmid);
        if (status.status !== 'running') {
          const startUpid = await proxmoxService.startVM(vm.vmid);
          await proxmoxService.waitForTask(startUpid, 120_000);
          onOutput(`[reset] vm ${vm.vmid}: powered back on`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`[reset] vm ${vm.vmid}: FAILED — ${msg}`);
        throw err;
      }
    });

    await Promise.all(tasks);
    onOutput(`[reset] slot ${slotNumber}: all VMs rolled back to baseline`);
  }

  /**
   * Deploy preflight — runs before every deploy to prove the slot is in a
   * known-clean state. Closes three drift classes that a fresh `terraform
   * apply` cannot recover from on its own:
   *   1. Slot already has tagged VMs (TF state lost or destroy was incomplete)
   *   2. Slot has orphan ZFS datasets (vm-N-disk-0 / vm-N-cloudinit) left
   *      behind from a prior run that VM deletion didn't reap
   *   3. Stale Terraform workspace state from a prior incomplete run
   *
   * Refuses to clean (1) automatically because existing VMs may hold work the
   * user wants — points the operator at /force-destroy. Cleans (2) and (3)
   * unconditionally because they are pure leftovers.
   */
  async deployPreflight(
    slotNumber: number,
    scenarioId: string,
    onOutput: OutputCallback,
  ): Promise<void> {
    onOutput(`[preflight] slot ${slotNumber}: validating clean state for ${scenarioId}`);

    // (1) Refuse if any VM is tagged for this slot — operator must force-destroy
    const vms = await proxmoxService.getVMsForSlot(slotNumber);
    if (vms.length > 0) {
      const names = vms.map((v) => `${v.vmid} (${v.name})`).join(', ');
      throw new Error(
        `Slot ${slotNumber} already has ${vms.length} VM(s): ${names}. ` +
          `Run Force Destroy to reclaim the slot before deploying.`,
      );
    }
    onOutput(`[preflight] no slot-tagged VMs present`);

    // (2) Prune orphan storage volumes in the slot's VM ID range.
    // Convention: slot N owns VM IDs 200+(N-1)*10 through +9. With (1) proven,
    // any volume on local-zfs whose vmid falls in that range has no owner.
    const vmIdBase = 200 + (slotNumber - 1) * 10;
    const vmIdMax = vmIdBase + 9;
    const storage = 'local-zfs';

    const orphans: string[] = [];
    for (let vmid = vmIdBase; vmid <= vmIdMax; vmid++) {
      try {
        const vols = await proxmoxService.listStorageContent(storage, vmid);
        for (const v of vols) orphans.push(v.volid);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        onOutput(`[preflight] storage scan vmid ${vmid}: ${msg} (continuing)`);
      }
    }

    if (orphans.length === 0) {
      onOutput(`[preflight] no orphan storage in vmid range ${vmIdBase}-${vmIdMax}`);
    } else {
      onOutput(
        `[preflight] pruning ${orphans.length} orphan volume(s) in range ${vmIdBase}-${vmIdMax}`,
      );
      for (const volid of orphans) {
        try {
          await proxmoxService.deleteStorageVolume(storage, volid);
          onOutput(`[preflight] deleted ${volid}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          onOutput(`[preflight] delete ${volid} FAILED: ${msg}`);
          throw new Error(`Preflight orphan cleanup failed on ${volid}: ${msg}`);
        }
      }
    }

    // (3) Reset Terraform workspace state. cleanupWorkspace is best-effort
    // and never throws; missing workspace is the desired post-condition.
    onOutput(`[preflight] resetting terraform workspace for ${scenarioId}`);
    await terraformService.cleanupWorkspace(slotNumber, scenarioId, onOutput);

    onOutput(`[preflight] slot ${slotNumber}: clean — deploy may proceed`);
  }

  /**
   * Force-destroy: the "fix it when Terraform won't" path.
   * Hard-stops all slot VMs, deletes them via Proxmox API, and clears
   * the TF workspace. Used when TF state drift orphans VMs.
   */
  async forceDestroySlot(slotNumber: number, onOutput: OutputCallback): Promise<void> {
    const vms = await proxmoxService.getVMsForSlot(slotNumber);

    if (vms.length === 0) {
      onOutput(`[force-destroy] slot ${slotNumber}: no VMs tagged — cleaning DB only`);
    } else {
      onOutput(`[force-destroy] slot ${slotNumber}: found ${vms.length} VM(s) to remove`);

      // Hard-stop anything running
      const running = vms.filter((v) => v.status !== 'stopped');
      if (running.length > 0) {
        onOutput(`[force-destroy] stopping ${running.length} running VM(s)`);
        await Promise.all(
          running.map(async (vm) => {
            try {
              const upid = await proxmoxService.stopVM(vm.vmid);
              await proxmoxService.waitForTask(upid, 60_000);
              onOutput(`[force-destroy] vm ${vm.vmid}: stopped`);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              onOutput(`[force-destroy] vm ${vm.vmid}: stop failed — ${msg} (continuing)`);
            }
          }),
        );
      }

      // Delete every VM
      onOutput(`[force-destroy] deleting ${vms.length} VM(s)`);
      await Promise.all(
        vms.map(async (vm) => {
          try {
            const upid = await proxmoxService.deleteVM(vm.vmid);
            await proxmoxService.waitForTask(upid, 120_000);
            onOutput(`[force-destroy] vm ${vm.vmid} (${vm.name}): deleted`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            onOutput(`[force-destroy] vm ${vm.vmid}: delete FAILED — ${msg}`);
            throw err;
          }
        }),
      );
    }

    // Best-effort workspace cleanup (scenario_id may be null, degrade gracefully)
    const slot = await query<{ scenario_id: string | null }>(
      'SELECT scenario_id FROM lab_slots WHERE slot_number = $1',
      [slotNumber],
    );
    const scenarioId = slot[0]?.scenario_id;
    if (scenarioId) {
      onOutput(`[force-destroy] cleaning terraform workspace for ${scenarioId}`);
      await terraformService.cleanupWorkspace(slotNumber, scenarioId, onOutput);
    } else {
      onOutput(`[force-destroy] no scenario_id in DB — skipping workspace cleanup`);
    }

    onOutput(`[force-destroy] slot ${slotNumber}: complete`);
  }

  /**
   * Single-VM rollback to baseline. Used for "oops I broke this one VM" recovery
   * without resetting the whole slot.
   */
  async rollbackVM(vmId: number, onOutput: OutputCallback): Promise<void> {
    const snapshots = await proxmoxService.listSnapshots(vmId);
    if (!snapshots.some((s) => s.name === BASELINE_SNAPSHOT)) {
      throw new Error(`VM ${vmId} has no '${BASELINE_SNAPSHOT}' snapshot`);
    }
    onOutput(`[rollback] vm ${vmId}: rolling back to '${BASELINE_SNAPSHOT}'`);
    const upid = await proxmoxService.rollbackSnapshot(vmId, BASELINE_SNAPSHOT);
    await proxmoxService.waitForTask(upid, 300_000);

    const status = await proxmoxService.getVMStatus(vmId);
    if (status.status !== 'running') {
      const startUpid = await proxmoxService.startVM(vmId);
      await proxmoxService.waitForTask(startUpid, 120_000);
    }
    onOutput(`[rollback] vm ${vmId}: complete`);
  }

  /**
   * Build a diagnostics snapshot for a slot: DB state, live VM state,
   * orphan detection, baseline snapshot coverage, and advisories.
   */
  async getDiagnostics(slotNumber: number): Promise<SlotDiagnostics> {
    const slotRows = await query<{
      status: string;
      scenario_id: string | null;
      tf_workspace: string | null;
    }>(
      'SELECT status, scenario_id, tf_workspace FROM lab_slots WHERE slot_number = $1',
      [slotNumber],
    );
    const slotRow = slotRows[0];
    if (!slotRow) {
      throw new Error(`Slot ${slotNumber} not found`);
    }

    const vms = await proxmoxService.getVMsForSlot(slotNumber);

    const diagnostics: VmDiagnostic[] = await Promise.all(
      vms.map(async (vm) => {
        let snapshots: ProxmoxSnapshot[] = [];
        try {
          snapshots = await proxmoxService.listSnapshots(vm.vmid);
        } catch {
          snapshots = [];
        }
        return {
          vmid: vm.vmid,
          name: vm.name,
          proxmox_status: vm.status,
          has_baseline_snapshot: snapshots.some((s) => s.name === BASELINE_SNAPSHOT),
          snapshot_count: snapshots.filter((s) => s.name !== 'current').length,
          tags: vm.tags?.split(/[,;]/).map((t) => t.trim()).filter(Boolean) ?? [],
          uptime: vm.uptime,
        };
      }),
    );

    const orphans: VmDiagnostic[] =
      slotRow.status === 'empty' ? diagnostics : [];

    const vmsWithoutBaseline = diagnostics
      .filter((d) => !d.has_baseline_snapshot)
      .map((d) => d.vmid);

    const advisories: string[] = [];

    if (orphans.length > 0) {
      advisories.push(
        `${orphans.length} VM(s) tagged for this slot but DB says empty. Use Force Destroy to clean up.`,
      );
    }
    if (vmsWithoutBaseline.length > 0 && diagnostics.length > 0) {
      advisories.push(
        `${vmsWithoutBaseline.length} of ${diagnostics.length} VM(s) missing baseline snapshot — reset will fail until snapshots are taken.`,
      );
    }
    if (slotRow.status === 'running' && diagnostics.every((d) => d.proxmox_status === 'stopped')) {
      advisories.push(
        'All VMs stopped but DB says running — status drift. Consider Shutdown to sync state.',
      );
    }
    if (slotRow.status === 'error') {
      advisories.push('Slot is in error state. Check deploy_log, then Force Destroy to recover.');
    }

    return {
      slot_number: slotNumber,
      db_status: slotRow.status,
      db_scenario_id: slotRow.scenario_id,
      vm_count: diagnostics.length,
      vms: diagnostics,
      orphan_vms: orphans,
      vms_without_baseline: vmsWithoutBaseline,
      workspace_expected: slotRow.tf_workspace,
      advisories,
    };
  }

  /**
   * Resolve a VM ID to its owning slot number by parsing tags.
   * Used by the per-VM routes to enforce slot ownership.
   */
  async getSlotForVM(vmId: number): Promise<number | null> {
    const vm = await proxmoxService.getVMStatus(vmId);
    const tags = vm.tags?.split(/[,;]/) ?? [];
    for (const tag of tags) {
      const match = tag.trim().match(/^student-slot-(\d+)$/);
      if (match && match[1]) return parseInt(match[1], 10);
    }
    return null;
  }

  /** Re-export for tests / inline VM inspection. */
  async getVMInfo(vmId: number): Promise<ProxmoxVM> {
    return proxmoxService.getVMStatus(vmId);
  }
}

export const scenarioLifecycle = new ScenarioLifecycleService();
