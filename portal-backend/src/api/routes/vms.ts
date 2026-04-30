/**
 * Per-VM lifecycle controls — lets instructors (and students on their own
 * slot) drive individual VMs without touching the whole scenario.
 *
 * Ownership: students may only act on VMs tagged for their assigned slot;
 * instructors and admins may act on any slot VM. We resolve ownership by
 * parsing the `student-slot-N` tag via scenarioLifecycle.getSlotForVM().
 *
 * Routes wait for the underlying Proxmox task to complete before responding
 * so the UI can refresh state immediately after a 200. Timeouts are per-op.
 */

import { Router } from 'express';
import type { Request } from 'express';
import { authenticate } from '../middleware/auth.js';
import { writeAuditLog } from '../middleware/auditLog.js';
import { getIp, param } from '../../utils/request.js';
import { proxmoxService } from '../../services/proxmox.js';
import { scenarioLifecycle } from '../../services/scenarioLifecycle.js';
import { pushStatusUpdate } from '../../services/statusBroadcast.js';
import { NotFoundError, ForbiddenError } from '../../utils/errors.js';

export const vmsRouter = Router();

vmsRouter.use(authenticate);

function parseVmId(req: Request): number {
  const raw = param(req, 'vmid');
  const id = parseInt(raw, 10);
  // Lab scenario VMs are 200-399; scratch 900-999. Templates (100-149) are
  // protected — acting on them would corrupt clone sources for every slot.
  if (!Number.isInteger(id) || id < 200 || id > 999) {
    throw new NotFoundError('Invalid VM ID');
  }
  return id;
}

/**
 * Resolve slot ownership for the authenticated user.
 * Students may only act on VMs tagged for their assigned slot.
 * Instructors and admins may act on any VM that belongs to a slot — an
 * untagged VM in the lab range is anomalous and rejected either way.
 */
async function authorizeVm(
  vmId: number,
  userRole: 'admin' | 'instructor' | 'student',
  userSlot: number | null,
): Promise<number> {
  const slot = await scenarioLifecycle.getSlotForVM(vmId);

  if (slot === null) {
    throw new ForbiddenError('VM is not part of a lab slot');
  }
  if (userRole === 'student') {
    if (!userSlot) throw new ForbiddenError('No slot assigned');
    if (slot !== userSlot) throw new ForbiddenError('Access denied to this VM');
  }
  return slot;
}

// ── POST /:vmid/start ────────────────────────────────────────────────────────

vmsRouter.post('/:vmid/start', async (req, res, next) => {
  try {
    const vmId = parseVmId(req);
    const slot = await authorizeVm(vmId, req.user!.role, req.user!.lab_slot);

    const upid = await proxmoxService.startVM(vmId);
    await proxmoxService.waitForTask(upid, 120_000);

    await writeAuditLog(
      req.user!.id,
      'vm_start',
      'vm',
      String(vmId),
      { slot },
      getIp(req),
    );
    pushStatusUpdate();

    res.json({ message: 'VM started', vmid: vmId });
  } catch (err) {
    next(err);
  }
});

// ── POST /:vmid/shutdown ─────────────────────────────────────────────────────
// Graceful ACPI shutdown with 60s timeout, then hard-stop fallback (forceStop=1).

vmsRouter.post('/:vmid/shutdown', async (req, res, next) => {
  try {
    const vmId = parseVmId(req);
    const slot = await authorizeVm(vmId, req.user!.role, req.user!.lab_slot);

    const upid = await proxmoxService.shutdownVM(vmId, 60);
    await proxmoxService.waitForTask(upid, 120_000);

    await writeAuditLog(
      req.user!.id,
      'vm_shutdown',
      'vm',
      String(vmId),
      { slot },
      getIp(req),
    );
    pushStatusUpdate();

    res.json({ message: 'VM shutdown', vmid: vmId });
  } catch (err) {
    next(err);
  }
});

// ── POST /:vmid/stop ─────────────────────────────────────────────────────────
// Hard power-off. Use when ACPI shutdown is not responding.

vmsRouter.post('/:vmid/stop', async (req, res, next) => {
  try {
    const vmId = parseVmId(req);
    const slot = await authorizeVm(vmId, req.user!.role, req.user!.lab_slot);

    const upid = await proxmoxService.stopVM(vmId);
    await proxmoxService.waitForTask(upid, 60_000);

    await writeAuditLog(
      req.user!.id,
      'vm_stop',
      'vm',
      String(vmId),
      { slot },
      getIp(req),
    );
    pushStatusUpdate();

    res.json({ message: 'VM force-stopped', vmid: vmId });
  } catch (err) {
    next(err);
  }
});

// ── POST /:vmid/reboot ───────────────────────────────────────────────────────
// Graceful ACPI reboot.

vmsRouter.post('/:vmid/reboot', async (req, res, next) => {
  try {
    const vmId = parseVmId(req);
    const slot = await authorizeVm(vmId, req.user!.role, req.user!.lab_slot);

    const upid = await proxmoxService.rebootVM(vmId, 60);
    await proxmoxService.waitForTask(upid, 180_000);

    await writeAuditLog(
      req.user!.id,
      'vm_reboot',
      'vm',
      String(vmId),
      { slot },
      getIp(req),
    );
    pushStatusUpdate();

    res.json({ message: 'VM rebooted', vmid: vmId });
  } catch (err) {
    next(err);
  }
});

// ── POST /:vmid/rollback ─────────────────────────────────────────────────────
// Rollback a single VM to its 'baseline' snapshot. May take up to 5 minutes
// depending on disk size — the client should show a loading state.
// Restricted to instructor/admin: students shouldn't be able to silently
// undo their own work on a single VM without instructor oversight.

vmsRouter.post('/:vmid/rollback', async (req, res, next) => {
  try {
    const vmId = parseVmId(req);

    if (req.user!.role === 'student') {
      res.status(403).json({ error: 'Instructor or admin required for rollback' });
      return;
    }
    const slot = await authorizeVm(vmId, req.user!.role, req.user!.lab_slot);

    await scenarioLifecycle.rollbackVM(vmId, () => {
      // Per-VM rollback doesn't stream to a slot log; progress is implicit in
      // the HTTP wait. If this grows to need streaming, wire it through WS.
    });

    await writeAuditLog(
      req.user!.id,
      'vm_rollback',
      'vm',
      String(vmId),
      { slot, snapshot: 'baseline' },
      getIp(req),
    );
    pushStatusUpdate();

    res.json({ message: 'VM rolled back to baseline', vmid: vmId });
  } catch (err) {
    next(err);
  }
});
